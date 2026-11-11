import { Injectable } from '@angular/core';
import { MAX_UPLOAD_BYTES } from '../limits';
import type {
  OfferLetterRequest,
  LookupResult,
  SalaryVerifyInput,
  AccountLookupResult,
  SalaryVerifyResult,
  BvnVerifyResult,
  DocUploadInput,
  DocUploadResult,
  SubmitPayload,
  LoanSummary,
  SubmitResult,
  MandateLink,
  MandateStatus,
  Bank,
  BvnContactsResult,
  OtpDestination,
  BvnOtpSendResult,
  BvnOtpVerifyResult,
  StatementReviewInput,
  WaitlistInput,
  WaitlistResult,
  EligibilityCheckInput,
  EligibilityCheckResult,
  ReturningOtpSendResult,
  ReturningOtpVerifyResult,
  StatementCheckInput,
  RequiredDocument,
  RequiredDocumentsInput,
  RequiredProfileField,
} from './api.types';
import type { ApiClient } from './api-client';
import { buildSimplePdf } from '../pdf/simple-pdf';
import { maskPhoneNg } from './contact.util';
import { scoreEligibility, type EligibilityInput } from '../eligibility/eligibility-scoring';
import { NG_BANKS } from './ng-banks';
import type { EmploymentAvailability } from './employment-availability';
import type { ReferralDraft } from '../application/application-state.service';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Unpredictable short reference (mock only; real ids come from the backoffice). */
function randomRef(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
}

function maskPhone(phone: string): string {
  // Show only the country code and last 2 digits.
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '••••';
  const head = digits.startsWith('234') ? '+234' : '';
  const tail = digits.slice(-2);
  return `${head} ${'•'.repeat(6)} ${tail}`.trim();
}

/**
 * In-process mock. Deterministic:
 * - BVN `33333333333` → returning customer (the mock BVN record has phone 08099999999).
 * - OTP `123456` = ok, `000000` = expired, else wrong.
 * - Account `0000000000` = not found; `1111111111` = name mismatch;
 *   `9999999999` = service down; `4444444444` = ok but ₦1,000/mo (to see a decline);
 *   anything else = ok at ₦180,000/mo.
 * - BVN `00000000000` = not-found, `11111111111` = name mismatch,
 *   `99999999999` = service-down, else ok.
 */
@Injectable({ providedIn: 'root' })
export class MockApiClient implements ApiClient {
  async lookupContact(input: { phone: string; email?: string }): Promise<LookupResult> {
    await delay(600);
    if (input.phone === '+2348099999999') {
      return {
        kind: 'returning',
        profileHint: 'A. Adeyemi',
        snapshot: {
          fullName: 'Adeola Adeyemi',
          lastLoanAt: '2026-03-14',
          employmentType: 'government',
          employerName: 'Federal Ministry of Works',
          bankName: 'Guaranty Trust Bank',
          accountLast4: '4472',
          monthlyIncome: 180_000,
        },
      };
    }
    return { kind: 'new' };
  }

  async listLoans(): Promise<LoanSummary[]> {
    await delay(500);
    return [
      { id: 'ln-1042', reference: 'PRN-8H2K4Q', productName: 'IPPIS Salary Advance', status: 'active', principal: 200_000, outstanding: 126_000, monthlyRepayment: 42_000, nextDueDate: '2026-12-25', instalmentsPaid: 2, instalmentsTotal: 5, ratePercent: 5, disbursedAt: '2026-09-02', mandateActive: true },
      { id: 'ln-0977', reference: 'PRN-3M9T7A', productName: 'IPPIS Standard Loan', status: 'overdue', principal: 80_000, outstanding: 28_000, monthlyRepayment: 28_000, nextDueDate: '2026-11-25', instalmentsPaid: 2, instalmentsTotal: 3, ratePercent: 5, disbursedAt: '2026-07-14', mandateActive: true },
      { id: 'ln-0801', reference: 'PRN-6C1D5W', productName: 'IPPIS Salary Advance', status: 'completed', principal: 150_000, outstanding: 0, monthlyRepayment: 52_500, nextDueDate: null, instalmentsPaid: 3, instalmentsTotal: 3, ratePercent: 5, disbursedAt: '2026-03-14', mandateActive: false },
    ];
  }

  async getOfferLetter(r: OfferLetterRequest): Promise<Uint8Array> {
    await delay(500);
    const naira = (n: number) => `NGN ${n.toLocaleString('en-NG')}`;
    return buildSimplePdf('Princeps loan offer (demo)', [
      `Product: ${r.productName}`,
      `Amount: ${naira(r.amount)}`,
      `Repayment period: ${r.tenorMonths} months`,
      `Monthly repayment: ${naira(r.monthlyRepayment)}`,
      `Total to repay: ${naira(r.monthlyRepayment * r.tenorMonths)}`,
      `Interest rate: ${r.ratePercent}%`,
      '',
      'This is a sample letter shown in the demo build.',
      'The real letter comes from Princeps after you accept the offer terms.',
    ]);
  }

  async submitStatementReview(_input: StatementReviewInput): Promise<SubmitResult> {
    await delay(900);
    return { status: 'received', referenceId: 'PRN-' + Math.random().toString(36).slice(2, 8).toUpperCase() };
  }

  async lookupBvnContacts(bvn: string, _captchaToken?: string): Promise<BvnContactsResult> {
    await delay(500);
    if (bvn === '00000000000') return { status: 'not-found' };
    if (bvn === '99999999999') return { status: 'service-down' };
    if (bvn === '44444444444') return { status: 'ok', phones: [], emails: [] }; // nothing the customer can still reach
    const last = bvn === '33333333333' ? '99' : '78';
    return {
      status: 'ok',
      phones: [
        { id: 'ph-1', masked: `+234 •••• ••${last}` },
        { id: 'ph-2', masked: '+234 •••• ••31' },
      ],
      emails: [{ id: 'em-1', masked: 'a•••@gmail.com' }],
    };
  }

  async sendBvnOtp(bvn: string, _captchaToken?: string, destination?: OtpDestination): Promise<BvnOtpSendResult> {
    await delay(600);
    if (bvn === '00000000000') return { status: 'not-found' };
    const target =
      destination?.kind === 'alternate-phone'
        ? maskPhoneNg(destination.phone)
        : destination?.id === 'em-1'
          ? 'a•••@gmail.com'
          : destination?.id === 'ph-2'
            ? '+234 •••• ••31'
            : '+234 •••• ••78';
    return { status: 'sent', target, expiresInSeconds: 300 };
  }

  async verifyBvnOtp(bvn: string, code: string): Promise<BvnOtpVerifyResult> {
    await delay(600);
    if (code === '000000') return { status: 'expired' };
    if (code !== '123456') return { status: 'wrong' };
    return {
      status: 'ok',
      identity: {
        firstName: 'Ada',
        fullName: 'Ada Okafor',
        dateOfBirth: '1988-04-12',
        phone: bvn === '33333333333' ? '08099999999' : '08012345678',
        gender: 'female',
        address: { street: '12 Allen Avenue', state: 'Lagos', lga: 'Ikeja' },
      },
      customerRef: 'demo-customer-ref-0001',
    };
  }

  async sendReturningOtp(_customerRef: string, _captchaToken?: string): Promise<ReturningOtpSendResult> {
    await delay(600);
    return { status: 'sent', target: '+234 •••• ••78', expiresInSeconds: 300 };
  }

  async verifyReturningOtp(customerRef: string, code: string): Promise<ReturningOtpVerifyResult> {
    await delay(600);
    if (code === '000000') return { status: 'expired' };
    if (code !== '123456') return { status: 'wrong' };
    return {
      status: 'ok',
      identity: { firstName: 'Ada', fullName: 'Ada Okafor', dateOfBirth: '1988-04-12', phone: '08012345678', gender: 'female' },
      bvn: '12345678901',
      customerRef,
    };
  }

  async getLgas(state: string): Promise<string[]> {
    await delay(150);
    const demo: Record<string, string[]> = {
      Lagos: ['Alimosho', 'Eti-Osa', 'Ikeja', 'Kosofe', 'Mushin', 'Surulere'],
      FCT: ['Abaji', 'Bwari', 'Gwagwalada', 'Kuje', 'Kwali', 'Municipal Area Council'],
      Kano: ['Fagge', 'Gwale', 'Nasarawa', 'Tarauni', 'Ungogo'],
    };
    return demo[state] ?? [];
  }

  async sendPhoneOtp(phone: string, _captchaToken?: string) {
    await delay(500);
    return { target: maskPhone(phone), expiresInSeconds: 300 };
  }

  async verifyPhoneOtp(_phone: string, code: string) {
    await delay(500);
    if (code === '123456') return { status: 'ok' } as const;
    if (code === '000000') return { status: 'expired' } as const;
    return { status: 'wrong' } as const;
  }

  async listBanks(): Promise<Bank[]> {
    await delay(150);
    return NG_BANKS;
  }

  async resolveAccount(_bankCode: string, accountNumber: string): Promise<AccountLookupResult> {
    await delay(600);
    if (accountNumber === '9999999999') return { status: 'service-down' };
    if (accountNumber === '0000000000') return { status: 'not-found' };
    return { status: 'ok', accountName: 'ADEYEMI ADEBAYO ADEWALE' };
  }

  async verifySalary(input: SalaryVerifyInput): Promise<SalaryVerifyResult> {
    await delay(900);
    if (input.accountNumber === '9999999999') return { status: 'service-down' };
    if (input.accountNumber === '0000000000') return { status: 'not-found' };
    if (input.accountNumber === '1111111111') return { status: 'name-mismatch' };
    if (input.accountNumber === '4444444444') return { status: 'ok', monthlyIncome: 1_000, accountName: 'A. Adeyemi' };
    return { status: 'ok', monthlyIncome: 180_000, accountName: 'A. Adeyemi' };
  }

  /** Demo of the limit: 4 checks per account in 30 minutes, like the real server. */
  private readonly checkTimes = new Map<string, number[]>();

  async checkEligibility(input: EligibilityCheckInput): Promise<EligibilityCheckResult> {
    await delay(900);
    const now = Date.now();
    const recent = (this.checkTimes.get(input.accountNumber) ?? []).filter((t) => now - t < 30 * 60_000);
    if (recent.length >= 4) return { status: 'rate-limited' };
    this.checkTimes.set(input.accountNumber, [...recent, now]);
    if (input.accountNumber === '9999999999') return { status: 'service-down' };
    if (input.accountNumber === '0000000000') return { status: 'not-found' };
    // Demo: a made-up pay by channel, scored the same way the app scores a verified one.
    const monthlyAmount = input.accountNumber === '4444444444' ? 1_000 : input.channel === 'dedukt' ? 150_000 : 180_000;
    const stability: EligibilityInput['stability'] =
      input.employmentType === 'corper'
        ? { type: 'nysc-corper', monthsRemaining: input.nyscMonthsRemaining ?? 0 }
        : { type: 'mda', category: input.employmentType === 'paramilitary' ? 'paramilitary' : input.governmentLevel === 'state' ? 'state' : 'federal' };
    const r = scoreEligibility({
      income: { source: input.channel === 'remita' ? 'remita' : input.channel === 'dedukt' ? 'deduct' : 'wacs', monthlyAmount },
      stability,
      repaymentHistory: { isRepeatBorrower: false },
      exposure: { hasActiveLoanElsewhere: false },
    });
    return { status: 'ok', decision: r.decision, maxAmount: r.maxEligibleAmount, tenorMonths: r.tenorMonths, monthlyIncome: monthlyAmount };
  }

  async checkStatement(input: StatementCheckInput): Promise<EligibilityCheckResult> {
    await delay(1200);
    if (input.fileName.toLowerCase().startsWith('fail')) return { status: 'service-down' };
    return { status: 'ok', decision: 'approved', maxAmount: 250_000, tenorMonths: 6, monthlyIncome: 200_000 };
  }

  /** Demo: the full set, so every document screen can be tried. Production asks the back end. */
  async getRequiredDocuments(input: RequiredDocumentsInput): Promise<RequiredDocument[]> {
    await delay(300);
    return [{ key: 'id', optional: false }, { key: input.employmentType === 'corper' ? 'callup' : 'payslip', optional: false }];
  }

  /** Demo: the standard order. */
  async getJourney(_productId: string): Promise<string[] | null> {
    return null;
  }

  /** Demo: ask for religion so the field can be tried. Production asks only what the back end lists. */
  async getRequiredProfileFields(): Promise<RequiredProfileField[]> {
    return [{ key: 'religion', optional: true }];
  }

  async verifyBvn(bvn: string, _fullName: string, _dateOfBirth: string): Promise<BvnVerifyResult> {
    await delay(900);
    if (bvn === '99999999999') return { status: 'service-down' };
    if (bvn === '00000000000') return { status: 'not-found' };
    if (bvn === '11111111111') return { status: 'name-mismatch' };
    return { status: 'ok' };
  }

  async verifyNin(nin: string, _fullName: string, _dateOfBirth: string): Promise<BvnVerifyResult> {
    await delay(900);
    if (nin === '99999999999') return { status: 'service-down' };
    if (nin === '00000000000') return { status: 'not-found' };
    if (nin === '11111111111') return { status: 'name-mismatch' };
    return { status: 'ok' };
  }

  private mandateChecks = new Map<string, number>();

  async createMandateLink(_input: {
    productId: string;
    channel: 'ippis' | 'remita' | 'dedukt';
    monthlyAmount: number;
    tenorMonths: number;
  }): Promise<MandateLink> {
    await delay(700);
    const reference = 'MD-' + randomRef();
    return { url: `https://example.com/mandate/${reference}`, reference };
  }

  /** Mock: pending for the first two checks, then completed. */
  async getMandateStatus(reference: string): Promise<MandateStatus> {
    await delay(400);
    const n = (this.mandateChecks.get(reference) ?? 0) + 1;
    this.mandateChecks.set(reference, n);
    return n >= 3 ? 'completed' : 'pending';
  }

  async uploadDocument(input: DocUploadInput): Promise<DocUploadResult> {
    await delay(800);
    if (input.sizeBytes > MAX_UPLOAD_BYTES) return { status: 'too-large' };
    return { status: 'ok' };
  }

  async submitApplication(_payload: SubmitPayload): Promise<SubmitResult> {
    await delay(1200);
    return { status: 'received', referenceId: 'PR-' + randomRef() };
  }

  async registerPush(_subscription: PushSubscriptionJSON): Promise<void> {
    await delay(300);
  }

  /** Demo: no back end, so the app keeps its own defaults. */
  async getEmploymentTypes(): Promise<EmploymentAvailability[] | null> {
    return null;
  }

  async joinWaitlist(_input: WaitlistInput): Promise<WaitlistResult> {
    await delay(600);
    return { status: 'ok', referenceId: 'WL-' + randomRef() };
  }

  /** Demo only: one made-up code. The real codes live on the server and are never in the app bundle. */
  async checkReferral(code: string): Promise<ReferralDraft | null> {
    await delay(300);
    return code.trim().toUpperCase() === 'DEMO10' ? { code: 'DEMO10', rateDiscountPct: 1, label: '1.0% rate discount' } : null;
  }
}
