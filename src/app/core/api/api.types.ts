// Shapes shared by the API clients, the mock and the screens. No logic lives here.

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

/**
 * The "how much can I get" check, before any identity. The back end does the real employment and salary check
 * from the account details and answers with a decision, the maximum and the verified monthly pay.
 */
export interface EligibilityCheckInput {
  employmentType: 'government' | 'paramilitary' | 'corper';
  governmentLevel?: 'federal' | 'state';
  nyscMonthsRemaining?: number;
  channel: 'remita' | 'ippis' | 'dedukt';
  bankCode: string;
  accountNumber: string;
  ippisNumber?: string;
  employer?: string;
  captchaToken?: string;
}

export type EligibilityCheckResult =
  | { status: 'ok'; decision: 'approved' | 'review' | 'declined'; maxAmount: number; tenorMonths: number; monthlyIncome: number }
  | { status: 'not-found' }
  | { status: 'rate-limited' }
  | { status: 'service-down' };

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
  contact: { phone: string; email?: string };
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
    /** Same value on every retry of one application, so the server can refuse a duplicate. */
    idempotencyKey: string;
    referralCode: string | null;
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

/** One loan the customer already has, as Caltos reports it. Amounts are naira; dates are ISO (YYYY-MM-DD). */
export interface LoanSummary {
  id: string;
  /** The reference quoted to support. */
  reference: string;
  productName: string;
  status: 'active' | 'overdue' | 'completed';
  principal: number;
  /** What is still owed, including interest. Zero once completed. */
  outstanding: number;
  monthlyRepayment: number;
  /** The next instalment date, or null when completed. */
  nextDueDate: string | null;
  instalmentsPaid: number;
  instalmentsTotal: number;
  ratePercent: number;
  disbursedAt: string;
  /** Whether the repayment mandate is in place. */
  mandateActive: boolean;
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

/**
 * What the BVN record gives us once the owner has confirmed with an OTP sent to the phone linked
 * to that BVN. The BVN photo is NEVER returned to the browser: it stays server-side for face match.
 */
export interface BvnIdentity {
  /** The first name only, used to greet the customer. Never shown in full. */
  firstName: string;
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  /** The phone number registered with the BVN. This becomes the contact number. */
  phone: string;
  gender?: 'male' | 'female';
}

/** A contact point tied to a BVN, shown only in part. `id` is an opaque reference the server understands. */
export interface MaskedContact {
  id: string;
  masked: string;
}

export type BvnContactsResult =
  | { status: 'ok'; phones: MaskedContact[]; emails: MaskedContact[] }
  | { status: 'not-found' }
  | { status: 'service-down' };

/** Where the one-time code goes: a contact already tied to the BVN, or a number the customer gives. */
export type OtpDestination =
  | { kind: 'bvn-contact'; id: string }
  | { kind: 'alternate-phone'; phone: string };

export type BvnOtpSendResult =
  | { status: 'sent'; target: string; expiresInSeconds: number }
  | { status: 'not-found' };

export type BvnOtpVerifyResult =
  | { status: 'ok'; identity: BvnIdentity }
  | { status: 'wrong' }
  | { status: 'expired' }
  | { status: 'locked'; retryAfterSeconds: number };

/** What the offer letter is for: the offer the customer is about to accept. */
export interface OfferLetterRequest {
  productId: string;
  productName: string;
  amount: number;
  tenorMonths: number;
  monthlyRepayment: number;
  ratePercent: number;
}

export interface StatementReviewInput {
  contact: { phone: string; email?: string };
  bvn: string;
  employer: string;
  bankCode: string;
  fileName: string;
  sizeBytes: number;
}

export type IncomeBand = 'under-100k' | '100-250k' | '250-500k' | '500-1m' | 'over-1m';
export type WaitlistChannel = 'whatsapp' | 'sms' | 'email';

export interface WaitlistInput {
  phone: string;
  email?: string;
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
