import type { ReferralDraft } from '../application/application-state.service';

const CODES: Record<string, { rateDiscountPct: number; label: string }> = {
  PRINCEPS10: { rateDiscountPct: 1.0, label: '1.0% rate discount' },
  NAIRA5: { rateDiscountPct: 0.5, label: '0.5% rate discount' },
  WELCOME: { rateDiscountPct: 0.75, label: '0.75% rate discount' },
};

export function validateReferralCode(input: string): ReferralDraft | null {
  const code = input.trim().toUpperCase();
  if (!code) return null;
  const match = CODES[code];
  if (!match) return null;
  return { code, rateDiscountPct: match.rateDiscountPct, label: match.label };
}
