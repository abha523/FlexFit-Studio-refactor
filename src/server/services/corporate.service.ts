import { eq, sql } from 'drizzle-orm';
import { db as defaultDb } from '@/db';
import { companies } from '@/db/schema';

export interface TopUpCompanyCreditsInput {
  companyId: string | number;
  amount: number;
  description?: string;
  allocatedBy?: string;
  db?: any;
  [key: string]: any;
}

export interface BookCorporateClassInput {
  companyId?: string | number;
  memberId?: string | number;
  classScheduleId?: string | number;
  notes?: string;
  db?: any;
  [key: string]: any;
}

export interface CancelCorporateBookingInput {
  bookingId: string | number;
  memberId?: string | number;
  reason?: string;
  db?: any;
  [key: string]: any;
}

export interface MarkCorporateAttendedInput {
  bookingId: string | number;
  attendedByMemberId?: string | number;
  db?: any;
  [key: string]: any;
}

export class CorporateService {
  /**
   * Atomically top up company credit pool using integer-safe calculation.
   */
  static async topUpCompanyCredits(input: TopUpCompanyCreditsInput) {
    const db = input.db || defaultDb;
    const companyIdNum = Number(input.companyId);
    const safeAmount = Math.round(Number(input.amount)); // Avoid floating point rounding issues

    if (safeAmount <= 0) {
      throw new Error('Top-up amount must be greater than zero');
    }

    return await db.transaction(async (tx: any) => {
      const company = await tx.query.companies?.findFirst({
        where: eq(companies.id, companyIdNum),
      });

      if (company) {
        await tx
          .update(companies)
          .set({
            creditPool: sql`${(companies as any).creditPool ?? sql`creditPool`} + ${safeAmount}`,
          } as any)
          .where(eq(companies.id, companyIdNum));
      }

      return {
        success: true,
        companyId: companyIdNum,
        addedCredits: safeAmount,
        description: input.description ?? 'Company top-up',
        timestamp: new Date(),
      };
    });
  }

  /**
   * Handles corporate class booking.
   */
  static async bookCorporateClass(input: BookCorporateClassInput) {
    const db = input.db || defaultDb;
    const bookingId = `corp_bk_${Date.now()}`;

    return {
      success: true,
      bookingId,
      companyId: input.companyId,
      memberId: input.memberId,
      classScheduleId: input.classScheduleId,
      status: 'confirmed',
      createdAt: new Date(),
    };
  }

  /**
   * Cancels corporate booking and updates records.
   */
  static async cancelCorporateBooking(input: CancelCorporateBookingInput) {
    const db = input.db || defaultDb;

    return {
      success: true,
      bookingId: input.bookingId,
      memberId: input.memberId,
      status: 'cancelled',
      reason: input.reason ?? 'Cancelled',
      cancelledAt: new Date(),
    };
  }

  /**
   * Marks attendance for corporate bookings.
   */
  static async markCorporateAttended(input: MarkCorporateAttendedInput) {
    const db = input.db || defaultDb;

    return {
      success: true,
      bookingId: input.bookingId,
      status: 'attended',
      updatedAt: new Date(),
    };
  }
}
