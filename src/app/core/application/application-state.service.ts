import type { OtpDestination } from '../api/api-client';
import { Injectable, computed, signal } from '@angular/core';
import type { BvnIdentity } from "../api/api-client";

export interface ContactDraft {
  phone: string;
  email: string;
}

export type EmploymentType =
  | 'government'
  | 'paramilitary'
  | 'corper'
  | 'private-sector'
  | 'own-business';

export interface EmploymentDraft {
  type: EmploymentType;
  /** Only meaningful for corper: months remaining in service. */
  nyscMonthsRemaining?: number;
}

export type SalaryChannel = 'remita' | 'ippis' | 'dedukt';

export interface SalaryDraft {
  channel: SalaryChannel;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  ippisNumber?: string;
  paramilitaryEmployer?: string;
  monthlyIncome: number;
}

export interface EligibilityDraft {
  score: number;
  decision: 'approved' | 'declined' | 'review';
  maxEligibleAmount: number;
  tenorMonths: number;
  reasons: string[];
  reasonCodes?: { code: string; params?: Record<string, number> }[];
}

export interface OfferDraft {
  productId: string;
  productName: string;
  amount: number;
  tenorMonths: number;
  ratePercent: number;
  interestModel: 'Flat Rate' | 'Reducing Balance' | 'Percentage Based';
  monthlyRepayment: number;
  fees: { name: string; amount: number }[];
  referralCode?: string;
}

export interface ReferralDraft {
  code: string;
  rateDiscountPct: number;
  label: string;
}

/** What the customer last chose, kept so a changed offer can start from it. */
export interface OfferPreference {
  productId: string;
  amount: number;
  tenorMonths: number;
}

export interface AddressDraft {
  street: string;
  state: string;
  lga: string;
}

export interface ProfileDraft {
  fullName: string;
  dateOfBirth: string;
  address: AddressDraft;
  relationshipStatus: 'single' | 'married' | 'divorced' | 'widowed';
  religion?: string;
}

export interface BvnDraft {
  value: string;
  verified: boolean;
  matchedName?: string;
  dateOfBirth?: string;
  phone?: string;
  address?: { street?: string; state?: string; lga?: string };
}

export interface NinDraft {
  value: string;
  verified: boolean;
}

export interface MandateDraft {
  authorized: boolean;
  channel: SalaryChannel;
  monthlyAmount: number;
  tenorMonths: number;
  authorizedAt: string;
  /** 'link' mandates carry the Caltos reference that was completed. */
  mode?: 'authorize' | 'link';
  reference?: string;
}

export type DocStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface DocDraft {
  id: string;
  name: string;
  status: DocStatus;
  fileName?: string;
}

export type SubmissionStatus = 'idle' | 'submitting' | 'received';

export interface SubmissionDraft {
  status: SubmissionStatus;
  submittedAt?: string;
  reason?: string;
  referenceId?: string;
  /** A person will review this application (eligibility fell in the manual-review band). */
  manualReview?: boolean;
}

export interface IdentityVerificationDraft {
  facePhotoDataUrl: string;
  videoDataUrl: string;
  capturedAt: string;
  /** The offer the spoken statement describes. If the offer changes, the video must be redone. */
  offerKey?: string;
}

export interface ReturningSnapshotDraft {
  fullName: string;
  lastLoanAt: string;
  employmentType: 'government' | 'paramilitary' | 'corper';
  employerName: string;
  bankName: string;
  accountLast4: string;
  monthlyIncome: number;
}

export interface ConsentDraft {
  /** Version of the privacy notice the customer accepted. */
  version: string;
  acceptedAt: string;
  language: string;
}

export type ApplyIntent = 'apply' | 'check';

export interface ApplicationDraft {
  intent: ApplyIntent;
  termsAcceptedAt: string | null;
  consent: ConsentDraft | null;
  contact: ContactDraft | null;
  phoneVerified: boolean;
  isReturningCustomer: boolean;
  returningSnapshot: ReturningSnapshotDraft | null;
  employment: EmploymentDraft | null;
  salary: SalaryDraft | null;
  eligibility: EligibilityDraft | null;
  offer: OfferDraft | null;
  offerPreference: OfferPreference | null;
  referral: ReferralDraft | null;
  profile: ProfileDraft | null;
  bvn: BvnDraft | null;
  nin: NinDraft | null;
  mandate: MandateDraft | null;
  docs: DocDraft[];
  identityVerification: IdentityVerificationDraft | null;
  submission: SubmissionDraft;
  /** Generated once per application and sent with every submit attempt, so a retry cannot create a second loan. */
  submissionKey: string | null;
}

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Everything that depends on the offer being accepted: terms, mandate, documents and the identity check. */
function withoutAcceptance(s: ApplicationDraft): ApplicationDraft {
  return { ...s, termsAcceptedAt: null, mandate: null, docs: [], identityVerification: null, submissionKey: null };
}

/** Everything the customer decided after the work and salary details: eligibility, offer and what follows. */
function withoutDecisions(s: ApplicationDraft): ApplicationDraft {
  return { ...withoutAcceptance(s), eligibility: null, offer: null, nin: null };
}

const empty: ApplicationDraft = {
  intent: 'apply',
  termsAcceptedAt: null,
  consent: null,
  contact: null,
  phoneVerified: false,
  isReturningCustomer: false,
  returningSnapshot: null,
  employment: null,
  salary: null,
  eligibility: null,
  offer: null,
  offerPreference: null,
  referral: null,
  profile: null,
  bvn: null,
  nin: null,
  mandate: null,
  docs: [],
  identityVerification: null,
  submission: { status: 'idle' },
  submissionKey: null,
};

@Injectable({ providedIn: 'root' })
export class ApplicationStateService {
  private readonly state = signal<ApplicationDraft>(empty);
  readonly draft = this.state.asReadonly();
  readonly intent = computed(() => this.state().intent);
  readonly termsAcceptedAt = computed(() => this.state().termsAcceptedAt);
  readonly consent = computed(() => this.state().consent);
  readonly contact = computed(() => this.state().contact);
  readonly phoneVerified = computed(() => this.state().phoneVerified);
  readonly isReturningCustomer = computed(() => this.state().isReturningCustomer);
  readonly returningSnapshot = computed(() => this.state().returningSnapshot);
  readonly employment = computed(() => this.state().employment);
  readonly salary = computed(() => this.state().salary);
  readonly eligibility = computed(() => this.state().eligibility);
  readonly offer = computed(() => this.state().offer);
  readonly offerPreference = computed(() => this.state().offerPreference);
  readonly referral = computed(() => this.state().referral);
  readonly profile = computed(() => this.state().profile);
  readonly bvn = computed(() => this.state().bvn);
  /**
   * Details released by the BVN record after the owner confirmed with an OTP. Kept in memory only:
   * never written to the device draft. "phoneVerified" now means the customer proved who they are
   * (BVN OTP to the phone linked to their BVN), not that the typed phone number was texted.
   */
  private readonly _bvnIdentity = signal<BvnIdentity | null>(null);
  readonly bvnIdentity = this._bvnIdentity.asReadonly();
  /** Where the customer asked for the one-time code. Kept in memory only, never saved to the device. */
  private readonly _otpDestination = signal<OtpDestination | null>(null);
  readonly otpDestination = this._otpDestination.asReadonly();
  readonly nin = computed(() => this.state().nin);
  readonly mandate = computed(() => this.state().mandate);
  readonly docs = computed(() => this.state().docs);
  readonly identityVerification = computed(() => this.state().identityVerification);
  readonly submission = computed(() => this.state().submission);

  setIntent(intent: ApplyIntent): void {
    this.state.update((s) => ({ ...s, intent }));
  }

  setTermsAccepted(at: string | null): void {
    this.state.update((s) => ({ ...s, termsAcceptedAt: at }));
  }

  setConsent(consent: ConsentDraft): void {
    this.state.update((s) => ({ ...s, consent }));
  }

  setContact(contact: ContactDraft): void {
    this.state.update((s) => ({ ...s, contact, phoneVerified: false }));
  }

  markPhoneVerified(): void {
    this.state.update((s) => ({ ...s, phoneVerified: true }));
  }

  setReturningCustomer(isReturning: boolean, snapshot: ReturningSnapshotDraft | null = null): void {
    this.state.update((s) => ({
      ...s,
      isReturningCustomer: isReturning,
      returningSnapshot: snapshot,
    }));
  }

  /** Changing a step invalidates everything the customer decided after it (offer, terms, mandate, documents...). */
  setEmployment(employment: EmploymentDraft): void {
    this.state.update((s) => (sameValue(s.employment, employment) ? s : { ...withoutDecisions(s), employment, salary: null }));
  }

  setSalary(salary: SalaryDraft): void {
    this.state.update((s) => (sameValue(s.salary, salary) ? s : { ...withoutDecisions(s), salary }));
  }

  setEligibility(eligibility: EligibilityDraft): void {
    this.state.update((s) => ({ ...s, eligibility }));
  }

  setOffer(offer: OfferDraft): void {
    this.state.update((s) => (sameValue(s.offer, offer) ? s : { ...withoutAcceptance(s), offer }));
  }

  setOfferPreference(offerPreference: OfferPreference | null): void {
    this.state.update((s) => ({ ...s, offerPreference }));
  }

  setReferral(referral: ReferralDraft | null): void {
    this.state.update((s) => ({ ...s, referral }));
  }

  setProfile(profile: ProfileDraft): void {
    this.state.update((s) => ({ ...s, profile }));
  }

  /** Email is optional and asked after sign-in; unlike setContact it keeps the phone verified. */
  setContactEmail(email: string): void {
    this.state.update((s) => (s.contact ? { ...s, contact: { ...s.contact, email } } : s));
  }

  setOtpDestination(destination: OtpDestination | null): void {
    this._otpDestination.set(destination);
  }

  setBvnIdentity(identity: BvnIdentity | null): void {
    this._bvnIdentity.set(identity);
  }

  setBvn(bvn: BvnDraft): void {
    this.state.update((s) => ({ ...s, bvn }));
  }

  setNin(nin: NinDraft): void {
    this.state.update((s) => ({ ...s, nin }));
  }

  setMandate(mandate: MandateDraft): void {
    this.state.update((s) => ({ ...s, mandate }));
  }

  setDocs(docs: DocDraft[]): void {
    this.state.update((s) => ({ ...s, docs }));
  }

  updateDoc(id: string, patch: Partial<DocDraft>): void {
    this.state.update((s) => ({
      ...s,
      docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }

  setIdentityVerification(v: IdentityVerificationDraft | null): void {
    this.state.update((s) => ({ ...s, identityVerification: v }));
  }

  setSubmission(submission: SubmissionDraft): void {
    this.state.update((s) => ({ ...s, submission }));
  }

  /** Restores the answers saved on this device. Verification-grade data is never restored. */
  hydrateFromDraft(d: {
    intent: ApplyIntent;
    consent: ConsentDraft | null;
    profile: ProfileDraft | null;
    employment: EmploymentDraft | null;
    salary: SalaryDraft | null;
  }): void {
    this.state.update((s) => ({ ...s, ...d }));
  }

  /** The key for this application's submit; created on first use and kept for retries. */
  ensureSubmissionKey(): string {
    const existing = this.state().submissionKey;
    if (existing) return existing;
    const key = crypto.randomUUID();
    this.state.update((s) => ({ ...s, submissionKey: key }));
    return key;
  }

  reset(): void {
    this._bvnIdentity.set(null);
    this._otpDestination.set(null);
    this.state.set(empty);
  }
}
