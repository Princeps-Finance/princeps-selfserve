import { findReferral } from '../../../shared/referral';
import type { ReferralDraft } from '../application/application-state.service';

/** Checks a code the customer typed. The server re-checks it: this only drives the preview. */
export function validateReferralCode(input: string): ReferralDraft | null {
  return findReferral(input);
}
