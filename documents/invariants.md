# FlexFit Studio: Behavioral Invariants & API Specifications

## 1. Exact Error Strings (Must Preserve Field-for-Field)
The following TRPCError messages are currently handled by frontend toast notifications and modal flows. They must not be changed:

- "Insufficient credit balance" (When member lacks credits to book/reserve)
- "Class not found" (Invalid class ID)
- "Member already booked or on waitlist for this class" (Duplicate booking prevention)
- "Booking not found" (Invalid booking ID on cancellation/attendance)
- "Company balance insufficient" (Corporate credit allocation cap reached)
- "Class is already at full capacity" (Hard cap check fallback)
- "Unauthorized" / "Forbidden" (Role-based access guardrails)

---

## 2. Core Workflows & Multi-Table Side Effects

### A. Booking Flow (`src/server/routers/bookings.ts`)
1. **Check Existing:** Query `bookings` for `userId` + `classId`. Throw if record exists.
2. **Capacity Check:** Count active `CONFIRMED` bookings for the target `classId`.
3. **If Capacity Available:**
   - Deduct 1 credit from member's `memberships` table (`creditsRemaining`).
   - Create `bookings` entry with status `'booked'` and `creditsUsed = class.creditCost`.
4. **If Capacity Full (Waitlist Flow):**
   - Place member on waitlist with `position = maxPosition + 1`.
   - Do **NOT** deduct credits while on waitlist.

### B. Reschedule / Cancellation Flow (`src/server/routers/reschedules.ts`)
1. **Cancel Booking:** Set target booking status to `'cancelled'` and record `cancelledAt`.
2. **Refund Credit:** Add 1 credit back to member's active membership `creditsRemaining`.
3. **Automated Waitlist Promotion:**
   - Fetch the #1 position on the waitlist for that class.
   - Upgrade their status from waitlist to `'booked'`.
   - Deduct 1 credit from the newly promoted member's active membership.
   - Re-index remaining waitlist positions (`position = position - 1`).

### C. Corporate Credit Allocation (`src/server/routers/corporate-bookings.ts` & `admin-companies.ts`)
1. Check `companies.creditPoolBalance`.
2. Deduct credits from the company pool when employee bookings are processed.
3. Throw `"Company balance insufficient"` if requested credits exceed available pool balance.

---

## 3. Shared Logic Matrix (Extraction Targets for Block 2)
1. **Credit Deductions & Refunds:** Duplicated across `bookings.ts`, `reschedules.ts`, and `payments.ts`.
2. **Waitlist Promotion & Re-indexing:** Duplicated across `reschedules.ts` and `classes.ts`.
3. **Corporate Pool Balance Checks:** Duplicated across `admin-companies.ts` and `corporate-bookings.ts`.
