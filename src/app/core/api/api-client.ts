import { InjectionToken, Injectable } from '@angular/core';

export interface ReturningProfileSnapshot {
  fullName: string;
  lastLoanAt: string;
  employmentType: 'government' | 'paramilitary' | 'corper';
  employerName: string;
  bankName: string;
  accountLast4: string;
  monthlyIncome: number;
}

export type LookupResult =
  | { kind: 'new' }
  | { kind: 'returning'; profileHint: string; snapshot: ReturningProfileSnapshot };

export interface SalaryVerifyInput {
  channel: 'remita' | 'ippis' | 'dedukt';
  bankCode: string;
  accountNumber: string;
  /** Name the customer gave in bio data; the account name must match it. */
  fullName: string;
  ippisNumber?: string;
  employer?: string;
}

export type SalaryVerifyResult =
  | { status: 'ok'; monthlyIncome: number; accountName: string }
  | { status: 'name-mismatch' }
  | { status: 'not-found' }
  | { status: 'service-down' };

/**
 * Identity checks answer match / no-match only. They never return the record
 * holder's name, date of birth, phone or address, so they cannot be used to
 * look a stranger up.
 */
export type BvnVerifyResult =
  | { status: 'ok' }
  | { status: 'name-mismatch' }
  | { status: 'not-found' }
  | { status: 'service-down' };

export interface DocUploadInput {
  docId: string;
  fileName: string;
  sizeBytes: number;
}

export type DocUploadResult =
  | { status: 'ok' }
  | { status: 'too-large' }
  | { status: 'bad-type' }
  | { status: 'network' };

export interface SubmitPayload {
  contact: { phone: string; email: string };
  employment: { type: string };
  offer: { productId: string; amount: number; tenorMonths: number };
  bvn: string;
  // Full loan record for the backoffice ingest. Optional so older call sites
  // still compile; when present, submit() posts to the real API.
  loan?: {
    productId: string;
    /** Web app version that produced this application. */
    appVersion: string;
    consentVersion: string;
    consentAt: string;
    /** Eligibility fell in the manual-review band. Caltos re-scores; this is a hint only. */
    manualReview: boolean;
    mandateReference: string | null;
    borrowerBvn: string;
    borrowerName: string;
    borrowerPhone: string;
    amountKobo: number;
    tenorMonths: number;
    monthlyRepaymentKobo: number;
    interestModel: 'Flat Rate' | 'Reducing Balance' | 'Percentage Based';
    ratePercent: number;
    channel: 'ippis' | 'remita' | 'dedukt';
    bankCode: string | null;
    accountNumber: string | null;
    ippisNumber: string | null;
    employmentType: 'government' | 'paramilitary' | 'corper';
    employer: string | null;
  };
}

/** The application reached Caltos. Caltos decides the outcome; the app never claims one. */
export interface SubmitResult {
  status: 'received';
  referenceId: string;
}

export interface MandateLink {
  /** https link the customer opens to complete the mandate with their bank or salary provider. */
  url: string;
  reference: string;
}

export type MandateStatus = 'pending' | 'completed' | 'failed';

export interface Bank {
  code: string;
  name: string;
}

export interface ApiClient {
  lookupContact(input: { phone: string; email: string }): Promise<LookupResult>;
  sendPhoneOtp(phone: string, captchaToken?: string): Promise<{ target: string; expiresInSeconds: number }>;
  verifyPhoneOtp(
    phone: string,
    code: string,
  ): Promise<
    | { status: 'ok' }
    | { status: 'wrong' }
    | { status: 'expired' }
    | { status: 'locked'; retryAfterSeconds: number }
  >;
  listBanks(): Promise<Bank[]>;
  verifySalary(input: SalaryVerifyInput): Promise<SalaryVerifyResult>;
  verifyBvn(bvn: string, fullName: string, dateOfBirth: string): Promise<BvnVerifyResult>;
  verifyNin(nin: string, fullName: string, dateOfBirth: string): Promise<BvnVerifyResult>;
  uploadDocument(input: DocUploadInput): Promise<DocUploadResult>;
  createMandateLink(input: {
    productId: string;
    channel: 'ippis' | 'remita' | 'dedukt';
    monthlyAmount: number;
    tenorMonths: number;
  }): Promise<MandateLink>;
  getMandateStatus(reference: string): Promise<MandateStatus>;
  submitApplication(payload: SubmitPayload): Promise<SubmitResult>;
  joinWaitlist(input: WaitlistInput): Promise<WaitlistResult>;
}

export type IncomeBand = 'under-100k' | '100-250k' | '250-500k' | '500-1m' | 'over-1m';
export type WaitlistChannel = 'whatsapp' | 'sms' | 'email';

export interface WaitlistInput {
  phone: string;
  email: string;
  type: string;
  employer?: string;
  incomeBand?: IncomeBand;
  channel: WaitlistChannel;
}

export interface WaitlistResult {
  status: 'ok';
  referenceId: string;
  /** Only shown when Caltos provides them; the app never invents a queue position or date. */
  positionInQueue?: number;
  estimatedWindow?: string;
}

export const API_CLIENT = new InjectionToken<ApiClient>('ApiClient');

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

export const NG_BANKS: Bank[] = [
  { code: '044', name: 'Access Bank' },
  { code: '063', name: 'Access Bank (Diamond)' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '526', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'SunTrust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '999', name: 'Opay' },
  { code: '998', name: 'Kuda Microfinance Bank' },
  { code: '997', name: 'Palmpay' },
];

/**
 * In-process mock. Deterministic:
 * - Contact email `returning@princeps.ng` → returning customer.
 * - OTP `123456` = ok, `000000` = expired, else wrong.
 * - Account `0000000000` = not found; `1111111111` = name mismatch;
 *   `9999999999` = service down; anything else = ok at ₦180,000/mo.
 * - BVN `00000000000` = not-found, `11111111111` = name mismatch,
 *   `99999999999` = service-down, else ok.
 */
@Injectable({ providedIn: 'root' })
export class MockApiClient implements ApiClient {
  async lookupContact(input: { phone: string; email: string }): Promise<LookupResult> {
    await delay(600);
    if (input.email.toLowerCase() === 'returning@princeps.ng') {
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

  async verifySalary(input: SalaryVerifyInput): Promise<SalaryVerifyResult> {
    await delay(900);
    if (input.accountNumber === '9999999999') return { status: 'service-down' };
    if (input.accountNumber === '0000000000') return { status: 'not-found' };
    if (input.accountNumber === '1111111111') return { status: 'name-mismatch' };
    return { status: 'ok', monthlyIncome: 180_000, accountName: 'A. Adeyemi' };
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
    if (input.sizeBytes > 10 * 1024 * 1024) return { status: 'too-large' };
    return { status: 'ok' };
  }

  async submitApplication(_payload: SubmitPayload): Promise<SubmitResult> {
    await delay(1200);
    return { status: 'received', referenceId: 'PR-' + randomRef() };
  }

  async joinWaitlist(_input: WaitlistInput): Promise<WaitlistResult> {
    await delay(600);
    return { status: 'ok', referenceId: 'WL-' + randomRef() };
  }
}
