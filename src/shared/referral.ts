// The shape of a referral discount and the rate maths. Framework-free, shared by the browser (to preview the
// discount) and the serverless submit function. The codes themselves are server-only: see api/_lib/referral-codes.ts.

export interface ReferralDiscount {
  code: string;
  rateDiscountPct: number;
  label: string;
}

/** The rate after the discount, never below zero. */
export function discountedRate(baseRatePercent: number, discount: ReferralDiscount | null): number {
  return discount ? Math.max(0, baseRatePercent - discount.rateDiscountPct) : baseRatePercent;
}
