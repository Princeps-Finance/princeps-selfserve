// Referral codes live here, on the server only. They must never be imported by browser code, or every
// visitor could read them from the app bundle. To change them without a release, set REFERRAL_CODES
// (JSON, for example {"CODE1":{"rateDiscountPct":1,"label":"1% rate discount"}}) in the Vercel environment.
import type { ReferralDiscount } from '../../src/shared/referral';

type CodeTable = Record<string, { rateDiscountPct: number; label: string }>;

const BUILT_IN: Readonly<CodeTable> = {
  PRINCEPS10: { rateDiscountPct: 1.0, label: '1.0% rate discount' },
  NAIRA5: { rateDiscountPct: 0.5, label: '0.5% rate discount' },
  WELCOME: { rateDiscountPct: 0.75, label: '0.75% rate discount' },
};

function table(): Readonly<CodeTable> {
  const raw = process.env['REFERRAL_CODES'];
  if (!raw) return BUILT_IN;
  try {
    const parsed = JSON.parse(raw) as CodeTable;
    return parsed && typeof parsed === 'object' ? parsed : BUILT_IN;
  } catch {
    console.error('REFERRAL_CODES is not valid JSON; using the built-in codes');
    return BUILT_IN;
  }
}

/** The discount for a code (case and spacing do not matter), or null when the code is unknown. */
export function findReferral(input: string | null | undefined): ReferralDiscount | null {
  const code = (input ?? '').trim().toUpperCase();
  const codes = table();
  const match = Object.hasOwn(codes, code) ? codes[code] : undefined;
  return match ? { code, ...match } : null;
}
