import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  bookings,
  classes,
  memberships,
  checkins,
  reschedules,
} from "@/db/schema";
import { CreditService } from "./credit.service";

export const FREE_CANCELLATION_HOURS = 12;
export const FREE_RESCHEDULE_HOURS = 4;
export const UNLIMITED_CREDITS = 999;

function hoursUntil(iso: string, now = new Date()): number {
  return (new Date(iso).getTime() - now.getTime()) / 36e5;
}

export class BookingService {
  /**
   * Book an individual class spot for a regular member.
   */
  static async bookIndividualClass({
    db,
    userId,
    classId,
  }: {
    db: any;
    userId: number;
    classId: number;
  }) {
    const cls = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId))
      .get();

    if (!cls) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Class not found." });
    }
    if (cls.cancelled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This class has been cancelled.",
      });
    }

    // Relaxed for dev testing (comment out or adjust offset if testing past classes)
    // if (hoursUntil(cls.startsAt) <= -24) { ... }

    const existing = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.classId, cls.id),
          eq(bookings.userId, userId),
          inArray(bookings.status, ["booked", "waitlisted"]),
        ),
      )
      .get();

    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You are already on the list for this class.",
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const membership = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.status, "active"),
          sql`${memberships.endDate} >= ${today}`,
        ),
      )
      .orderBy(desc(memberships.endDate))
      .get();

    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "An active membership is required to book classes.",
      });
    }

    const isUnlimited = membership.creditsRemaining >= UNLIMITED_CREDITS;
    if (!isUnlimited && membership.creditsRemaining < cls.creditCost) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Not enough class credits remaining.",
      });
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(
        and(eq(bookings.classId, cls.id), eq(bookings.status, "booked")),
      );

    const isFull = Number(count) >= cls.capacity;

    const created = await db
      .insert(bookings)
      .values({
        classId: cls.id,
        userId,
        membershipId: membership.id,
        status: isFull ? "waitlisted" : "booked",
        creditsUsed: isFull ? 0 : cls.creditCost,
      })
      .returning()
      .get();

    if (!isFull && !isUnlimited) {
      await CreditService.deductMemberCredits({
        db,
        membershipId: membership.id,
        amount: cls.creditCost,
      });
    }

    return created;
  }

  static async cancelIndividualBooking({
    db,
    userId,
    isStaff,
    bookingId,
  }: {
    db: any;
    userId: number;
    isStaff: boolean;
    bookingId: number;
  }) {
    const row = await db
      .select({ booking: bookings, cls: classes })
      .from(bookings)
      .innerJoin(classes, eq(bookings.classId, classes.id))
      .where(eq(bookings.id, bookingId))
      .get();

    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
    }

    const isOwner = row.booking.userId === userId;
    if (!isOwner && !isStaff) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You cannot cancel this booking.",
      });
    }

    if (row.booking.status !== "booked" && row.booking.status !== "waitlisted") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This booking is no longer active.",
      });
    }

    const refundable =
      hoursUntil(row.cls.startsAt) >= FREE_CANCELLATION_HOURS &&
      row.booking.creditsUsed > 0;

    await db
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: new Date().toISOString() })
      .where(eq(bookings.id, row.booking.id));

    if (refundable && row.booking.membershipId) {
      await CreditService.refundMemberCredits({
        db,
        membershipId: row.booking.membershipId,
        amount: row.booking.creditsUsed,
      });
    }

    if (row.booking.status === "booked") {
      const next = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.classId, row.cls.id),
            eq(bookings.status, "waitlisted"),
          ),
        )
        .orderBy(asc(bookings.bookedAt))
        .get();

      if (next) {
        await db
          .update(bookings)
          .set({ status: "booked", creditsUsed: row.cls.creditCost })
          .where(eq(bookings.id, next.id));

        if (next.membershipId) {
          await CreditService.deductMemberCredits({
            db,
            membershipId: next.membershipId,
            amount: row.cls.creditCost,
          });
        }
      }
    }

    return { ok: true, refunded: refundable };
  }

  static async rescheduleBooking({
    db,
    userId,
    fromBookingId,
    toClassId,
  }: {
    db: any;
    userId: number;
    fromBookingId: number;
    toClassId: number;
  }) {
    const originalRow = await db
      .select({ booking: bookings, cls: classes })
      .from(bookings)
      .innerJoin(classes, eq(bookings.classId, classes.id))
      .where(eq(bookings.id, fromBookingId))
      .get();

    if (!originalRow) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
    }

    const { booking: originalBooking, cls: originalClass } = originalRow;

    if (originalBooking.userId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You cannot reschedule this booking.",
      });
    }

    if (originalBooking.status !== "booked" && originalBooking.status !== "waitlisted") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This booking is no longer active.",
      });
    }

    if (hoursUntil(originalClass.startsAt) < FREE_RESCHEDULE_HOURS) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `You can only reschedule up to ${FREE_RESCHEDULE_HOURS} hours before the class starts.`,
      });
    }

    const targetClass = await db
      .select()
      .from(classes)
      .where(eq(classes.id, toClassId))
      .get();

    if (!targetClass) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Target class not found." });
    }

    if (targetClass.name !== originalClass.name) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You can only reschedule to a class with the same name.",
      });
    }

    if (targetClass.id === originalClass.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You are already booked for this class.",
      });
    }

    if (targetClass.cancelled) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This class has been cancelled." });
    }

    const existingBooking = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.classId, targetClass.id),
          eq(bookings.userId, userId),
          sql`${bookings.status} in ('booked', 'waitlisted')`,
        ),
      )
      .get();

    if (existingBooking) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You already have an active booking for this class.",
      });
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(
        and(eq(bookings.classId, targetClass.id), eq(bookings.status, "booked")),
      );

    const targetIsFull = Number(count) >= targetClass.capacity;

    const newBooking = await db
      .insert(bookings)
      .values({
        classId: targetClass.id,
        userId,
        membershipId: originalBooking.membershipId,
        status: targetIsFull ? "waitlisted" : "booked",
        creditsUsed: originalBooking.creditsUsed,
      })
      .returning()
      .get();

    await db
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: new Date().toISOString() })
      .where(eq(bookings.id, originalBooking.id));

    await db.insert(reschedules).values({
      userId,
      fromBookingId: originalBooking.id,
      toBookingId: newBooking.id,
      fromClassId: originalClass.id,
      toClassId: targetClass.id,
    });

    return {
      ok: true,
      newBooking,
      newStatus: targetIsFull ? "waitlisted" : "booked",
    };
  }

  static async validateReschedule({
    db,
    userId,
    fromBookingId,
    toClassId,
  }: {
    db: any;
    userId: number;
    fromBookingId: number;
    toClassId: number;
  }) {
    const originalRow = await db
      .select({ booking: bookings, cls: classes })
      .from(bookings)
      .innerJoin(classes, eq(bookings.classId, classes.id))
      .where(eq(bookings.id, fromBookingId))
      .get();

    if (!originalRow) {
      return { valid: false, reason: "Booking not found." };
    }

    const { booking: originalBooking, cls: originalClass } = originalRow;

    if (originalBooking.userId !== userId) {
      return { valid: false, reason: "You cannot reschedule this booking." };
    }

    if (originalBooking.status !== "booked" && originalBooking.status !== "waitlisted") {
      return { valid: false, reason: "This booking is no longer active." };
    }

    if (hoursUntil(originalClass.startsAt) < FREE_RESCHEDULE_HOURS) {
      return {
        valid: false,
        reason: `You can only reschedule up to ${FREE_RESCHEDULE_HOURS} hours before class starts.`,
      };
    }

    const targetClass = await db
      .select()
      .from(classes)
      .where(eq(classes.id, toClassId))
      .get();

    if (!targetClass) {
      return { valid: false, reason: "Target class not found." };
    }

    if (targetClass.name !== originalClass.name) {
      return { valid: false, reason: "You can only reschedule to a class with the same name." };
    }

    if (targetClass.id === originalClass.id) {
      return { valid: false, reason: "You are already booked for this class." };
    }

    if (targetClass.cancelled) {
      return { valid: false, reason: "This class has been cancelled." };
    }

    const existingBooking = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.classId, targetClass.id),
          eq(bookings.userId, userId),
          sql`${bookings.status} in ('booked', 'waitlisted')`,
        ),
      )
      .get();

    if (existingBooking) {
      return { valid: false, reason: "You already have an active booking for this class." };
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(eq(bookings.classId, targetClass.id), eq(bookings.status, "booked")));

    return {
      valid: true,
      targetIsFull: Number(count) >= targetClass.capacity,
    };
  }

  static async markAttended({
    db,
    bookingId,
    source,
  }: {
    db: any;
    bookingId: number;
    source: "front_desk" | "kiosk" | "app";
  }) {
    const booking = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .get();

    if (!booking) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
    }
    if (booking.status !== "booked") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only confirmed bookings can be checked in.",
      });
    }

    await db
      .update(bookings)
      .set({ status: "attended" })
      .where(eq(bookings.id, booking.id));

    await db.insert(checkins).values({
      userId: booking.userId,
      bookingId: booking.id,
      source,
    });

    return { ok: true };
  }
}
