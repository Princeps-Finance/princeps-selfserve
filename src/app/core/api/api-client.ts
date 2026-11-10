import { InjectionToken } from '@angular/core';
import type { EmploymentAvailability } from './employment-availability';
import type { ReferralDraft } from '../application/application-state.service';
import type {
  Bank, BvnContactsResult, EligibilityCheckInput, EligibilityCheckResult, BvnOtpSendResult, BvnOtpVerifyResult, BvnVerifyResult, DocUploadInput, DocUploadResult,
  LoanSummary, LookupResult, MandateLink, OfferLetterRequest, MandateStatus, OtpDestination, SalaryVerifyInput, SalaryVerifyResult,
  StatementReviewInput, SubmitPayload, SubmitResult, WaitlistInput, WaitlistResult,
} from './api.types';

// Existing imports of these shapes from './api-client' keep working.
export type * from './api.types';

export interface ApiClient {
  /**
   * Private-sector applicants are not scored automatically: a bank statement is reviewed by a person.
   * Caltos receives the request and decides; the app never claims an outcome.
   */
  submitStatementReview(input: StatementReviewInput): Promise<SubmitResult>;
  /** The phone numbers and emails tied to a BVN, masked, so the customer can choose where to get the code. */
  lookupBvnContacts(bvn: string, captchaToken?: string): Promise<BvnContactsResult>;
  /** Sends a one-time code to the chosen contact. With no destination it goes to the BVN's main phone. */
  sendBvnOtp(bvn: string, captchaToken?: string, destination?: OtpDestination): Promise<BvnOtpSendResult>;
  /** A correct code proves the customer owns the BVN, and releases the details for it. */
  verifyBvnOtp(bvn: string, code: string): Promise<BvnOtpVerifyResult>;
  /** Local government areas for a state. An empty list means the user types it instead. */
  getLgas(state: string): Promise<string[]>;
  lookupContact(input: { phone: string; email?: string }): Promise<LookupResult>;
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
  /** The customer's loans from Caltos. Rejects when the service cannot be reached. */
  listLoans(): Promise<LoanSummary[]>;
  /** The offer letter as PDF bytes. Rejects when it cannot be produced or fetched. */
  getOfferLetter(request: OfferLetterRequest): Promise<Uint8Array>;
  submitApplication(payload: SubmitPayload): Promise<SubmitResult>;
  joinWaitlist(input: WaitlistInput): Promise<WaitlistResult>;
  /** Which employment types the back end can serve now. Null when it cannot be reached: the app then keeps its own defaults. */
  /** Checks employment and salary from the account details, with no identity. Answers a decision and a maximum only. */
  checkEligibility(input: EligibilityCheckInput): Promise<EligibilityCheckResult>;
  /** Gives the back end this device's push subscription, so it can send updates about the application. */
  registerPush(subscription: PushSubscriptionJSON): Promise<void>;
  getEmploymentTypes(): Promise<EmploymentAvailability[] | null>;
  /** Checks a referral code with the server. Null when the code is not valid or the check could not be made. */
  checkReferral(code: string): Promise<ReferralDraft | null>;
}

export const API_CLIENT = new InjectionToken<ApiClient>('ApiClient');
