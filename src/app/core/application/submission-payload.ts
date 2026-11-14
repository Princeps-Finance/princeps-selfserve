import { APP_VERSION } from '../app-version';
import type { SubmitPayload } from '../api/api-client';
import type { ApplicationStateService } from './application-state.service';

export type PayloadResult =
  | { ok: true; payload: SubmitPayload }
  | { ok: false; missing: 'contact' | 'employment' | 'offer' | 'bvn' | 'consent' | 'salary' | 'employment-type' };

type LoanEmployment = 'government' | 'paramilitary' | 'corper';

const isLoanEmployment = (t: string): t is LoanEmployment =>
  t === 'government' || t === 'paramilitary' || t === 'corper';

const toKobo = (naira: number): number => Math.round(naira * 100);

/** Turns the application state into the submit request, or says which required part is missing. */
export function buildSubmitPayload(state: ApplicationStateService, idempotencyKey: string): PayloadResult {
  const contact = state.contact();
  const employment = state.employment();
  const offer = state.offer();
  const bvn = state.bvn();
  const consent = state.consent();
  const salary = state.salary();
  if (!contact) return { ok: false, missing: 'contact' };
  if (!employment) return { ok: false, missing: 'employment' };
  if (!offer) return { ok: false, missing: 'offer' };
  if (!bvn) return { ok: false, missing: 'bvn' };
  if (!consent) return { ok: false, missing: 'consent' };
  if (!salary) return { ok: false, missing: 'salary' };
  if (!isLoanEmployment(employment.type)) return { ok: false, missing: 'employment-type' };

  return {
    ok: true,
    payload: {
      contact: { phone: contact.phone, email: contact.email },
      employment: { type: employment.type },
      offer: { productId: offer.productId, amount: offer.amount, tenorMonths: offer.tenorMonths },
      bvn: bvn.value,
      loan: {
        productId: offer.productId,
        appVersion: APP_VERSION,
        consentVersion: consent.version,
        consentAt: consent.acceptedAt,
        manualReview: state.eligibility()?.decision === 'review',
        mandateReference: state.mandate()?.reference ?? null,
        idempotencyKey,
        referralCode: offer.referralCode ?? null,
        borrowerBvn: bvn.value,
        borrowerName: state.profile()?.fullName ?? bvn.matchedName ?? 'Unknown',
        borrowerPhone: contact.phone,
        amountKobo: toKobo(offer.amount),
        tenorMonths: offer.tenorMonths,
        monthlyRepaymentKobo: toKobo(offer.monthlyRepayment),
        quoteId: offer.quote?.quoteId ?? null,
        interestModel: offer.interestModel,
        ratePercent: offer.ratePercent,
        channel: salary.channel,
        bankCode: salary.bankCode || null,
        accountNumber: salary.accountNumber || null,
        ippisNumber: salary.ippisNumber || null,
        employmentType: employment.type,
        employer: salary.paramilitaryEmployer ?? null,
        religion: state.profile()?.religion || null,
      },
    },
  };
}
