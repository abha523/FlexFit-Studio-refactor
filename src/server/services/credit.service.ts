export interface TopUpCompanyCreditsInput {
  companyId: string | number;
  amount: number;
  description?: string;
  allocatedBy?: string;
  db?: any;
  [key: string]: any;
}

export interface SubscribeToPlanInput {
  memberId?: string | number;
  planId: string | number;
  paymentMethodId?: string;
  db?: any;
  [key: string]: any;
}

export interface DeductMemberCreditsInput {
  memberId?: string | number;
  amount?: number;
  reason?: string;
  bookingId?: string | number;
  db?: any;
  [key: string]: any;
}

export interface RefundMemberCreditsInput {
  memberId?: string | number;
  amount?: number;
  reason?: string;
  bookingId?: string | number;
  db?: any;
  [key: string]: any;
}

export class CreditService {
  static async topUpCompanyCredits(input: TopUpCompanyCreditsInput) {
    return {
      success: true,
      companyId: input.companyId,
      addedCredits: input.amount,
      description: input.description ?? 'Company top-up',
      timestamp: new Date(),
    };
  }

  static async subscribeToPlan(input: SubscribeToPlanInput) {
    return {
      success: true,
      memberId: input.memberId,
      planId: input.planId,
      status: 'active',
      subscribedAt: new Date(),
    };
  }

  static async deductMemberCredits(input: DeductMemberCreditsInput) {
    return {
      success: true,
      memberId: input.memberId,
      deductedAmount: input.amount ?? 0,
      reason: input.reason ?? 'Class booking deduction',
      bookingId: input.bookingId,
      timestamp: new Date(),
    };
  }

  static async refundMemberCredits(input: RefundMemberCreditsInput) {
    return {
      success: true,
      memberId: input.memberId,
      refundedAmount: input.amount ?? 0,
      reason: input.reason ?? 'Class cancellation refund',
      bookingId: input.bookingId,
      timestamp: new Date(),
    };
  }
}
