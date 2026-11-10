// Referral codes and the rate discount they give. Framework-free and shared by the browser (to preview the
// discount) and the serverless submit function (the only place the discount is actually granted).

export interface ReferralDiscount {
  code: string;
  rateDiscountPct: number;
  label: string;
}

const CODES: Readonly<Record<string, { rateDiscountPct: number; label: string }>> = {
  PRINCEPS10: { rateDiscountPct: 1.0, label: '1.0% rate discount' },
  NAIRA5: { rateDiscountPct: 0.5, label: '0.5% rate discount' },
  WELCOME: { rateDiscountPct: 0.75, label: '0.75% rate discount' },
};

/** The discount for a code (case and spacing do not matter), or null when the code is unknown. */
export function findReferral(input: string | null | undefined): ReferralDiscount | null {
  const code = (input ?? '').trim().toUpperCase();
  const match = Object.hasOwn(CODES, code) ? CODES[code] : undefined;
  return match ? { code, ...match } : null;
}

/** The rate after the discount, never below zero. */
export function discountedRate(baseRatePercent: number, discount: ReferralDiscount | null): number {
  return discount ? Math.max(0, baseRatePercent - discount.rateDiscountPct) : baseRatePercent;
}
