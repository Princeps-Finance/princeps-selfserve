import { MAX_UPLOAD_BYTES, REQUEST_TIMEOUT_MS } from '../limits';
import { logWarn } from '../log';
import { Injectable, inject } from '@angular/core';
import { IdempotencyService } from './idempotency.service';
import {
  ApiClient,
  Bank,
  BvnOtpSendResult,
  BvnOtpVerifyResult,
  BvnIdentity,
  BvnVerifyResult,
  DocUploadInput,
  DocUploadResult,
  BvnContactsResult,
  LoanSummary,
  OfferLetterRequest,
  OtpDestination,
  LookupResult,
  MandateLink,
  MandateStatus,
  SalaryVerifyInput,
  SalaryVerifyResult,
  StatementReviewInput,
  EligibilityCheckInput,
  EligibilityCheckResult,
  StatementCheckInput,
  SubmitPayload,
  SubmitResult,
  WaitlistInput,
  WaitlistResult,
} from './api-client';
import { NG_BANKS } from './ng-banks';
import type { EmploymentAvailability } from './employment-availability';
import type { ReferralDraft } from '../application/application-state.service';

/** The service could not be reached or returned something unusable. */
export class ApiUnavailableError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
  ) {
    super(`API unavailable: ${code}`);
  }
}


interface Reply<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

/**
 * Production client. Every call goes to our own /api functions, which
 * validate, rate-limit and forward to the backoffice with a server-held token.
 * Nothing here is trusted for security: the backoffice re-checks everything.
 *
 * `token` is the opaque application token the backoffice issues once the
 * phone OTP is verified. It is held in memory only and sent with later calls
 * so the backoffice can refuse a submission that skipped verification.
 */
/** About 5 MB of PDF once decoded; anything larger is refused. */
const MAX_LETTER_BASE64 = 7_000_000;

@Injectable({ providedIn: 'root' })
export class HttpApiClient implements ApiClient {
  private token: string | null = null;
  private readonly idempotency = inject(IdempotencyService);

  private async post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<Reply<T>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['X-Application-Token'] = this.token;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        credentials: 'same-origin',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = (await res.json().catch(() => null)) as T | null;
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      logWarn(`request failed: ${path}`, err);
      return { ok: false, status: 0, data: null };
    }
  }

  /** Runs an API call; when the service cannot be reached, answers with `fallback` instead of throwing. */
  private async opOr<T>(name: string, body: unknown, fallback: T): Promise<T> {
    try {
      return await this.op<T>(name, body);
    } catch (err) {
      logWarn(`${name} unavailable`, err);
      return fallback;
    }
  }

  private async op<T>(name: string, body: unknown, idempotencyKey?: string): Promise<T> {
    const r = await this.post<T>(`/api/selfserve/${name}`, withoutEmptyEmail(body), idempotencyKey);
    if (!r.ok || r.data === null) throw new ApiUnavailableError(name, r.status);
    return r.data;
  }

  lookupContact(input: { phone: string; email?: string }): Promise<LookupResult> {
    return this.op<LookupResult>('lookup-contact', input);
  }

  async submitStatementReview(input: StatementReviewInput): Promise<SubmitResult> {
    const r = await this.op<{ status?: string; referenceId?: string }>(
      'statement-review',
      input,
      this.idempotency.keyFor(`statement:${input.fileName}:${input.sizeBytes}`),
    );
    if (r.status !== 'received' || typeof r.referenceId !== 'string') throw new ApiUnavailableError('statement-review', 502);
    return { status: 'received', referenceId: r.referenceId };
  }

  lookupBvnContacts(bvn: string, captchaToken?: string): Promise<BvnContactsResult> {
    return this.opOr<BvnContactsResult>('bvn-contacts', captchaToken ? { bvn, captchaToken } : { bvn }, { status: 'service-down' });
  }

  async sendBvnOtp(bvn: string, captchaToken?: string, destination?: OtpDestination): Promise<BvnOtpSendResult> {
    const r = await this.op<{ status?: string; target?: string; expiresInSeconds?: number }>('send-bvn-otp', {
      bvn,
      ...(captchaToken ? { captchaToken } : {}),
      ...(destination ? { destination } : {}),
    });
    if (r.status === 'not-found') return { status: 'not-found' };
    if (typeof r.target !== 'string') throw new ApiUnavailableError('send-bvn-otp', 502);
    return { status: 'sent', target: r.target, expiresInSeconds: r.expiresInSeconds ?? 300 };
  }

  async verifyBvnOtp(bvn: string, code: string): Promise<BvnOtpVerifyResult> {
    const r = await this.post<{ status: string; retryAfterSeconds?: number; token?: string; identity?: BvnIdentity }>(
      '/api/selfserve/verify-bvn-otp',
      { bvn, code },
    );
    if (r.status === 429) return { status: 'locked', retryAfterSeconds: 60 };
    if (!r.ok || !r.data) throw new ApiUnavailableError('verify-bvn-otp', r.status);
    switch (r.data.status) {
      case 'ok': {
        // Fail closed: no token or no identity means the backoffice did not confirm ownership.
        if (typeof r.data.token !== 'string' || !r.data.identity || typeof r.data.identity.fullName !== 'string') {
          throw new ApiUnavailableError('verify-bvn-otp', 502);
        }
        this.token = r.data.token;
        return { status: 'ok', identity: r.data.identity };
      }
      case 'expired':
        return { status: 'expired' };
      case 'locked':
        return { status: 'locked', retryAfterSeconds: r.data.retryAfterSeconds ?? 60 };
      default:
        return { status: 'wrong' };
    }
  }

  async getLgas(state: string): Promise<string[]> {
    try {
      const r = await this.op<{ lgas: string[] }>('lgas', { state });
      return Array.isArray(r.lgas) ? r.lgas.filter((x) => typeof x === 'string') : [];
    } catch (err) {
        logWarn('api step 1 failed', err);
return []; // The user can type it.
    }
  }

  sendPhoneOtp(phone: string, captchaToken?: string): Promise<{ target: string; expiresInSeconds: number }> {
    return this.op('send-otp', captchaToken ? { phone, captchaToken } : { phone });
  }

  async verifyPhoneOtp(phone: string, code: string) {
    const r = await this.post<{ status: string; retryAfterSeconds?: number; token?: string }>(
      '/api/selfserve/verify-otp',
      { phone, code },
    );
    if (r.status === 429) return { status: 'locked', retryAfterSeconds: 60 } as const;
    if (!r.ok || !r.data) throw new ApiUnavailableError('verify-otp', r.status);
    switch (r.data.status) {
      case 'ok':
        // No token means the backoffice did not confirm verification: fail closed.
        if (typeof r.data.token !== 'string') throw new ApiUnavailableError('verify-otp', 502);
        this.token = r.data.token;
        return { status: 'ok' } as const;
      case 'expired':
        return { status: 'expired' } as const;
      case 'locked':
        return { status: 'locked', retryAfterSeconds: r.data.retryAfterSeconds ?? 60 } as const;
      default:
        return { status: 'wrong' } as const;
    }
  }

  async listBanks(): Promise<Bank[]> {
    try {
      const r = await this.op<{ banks: Bank[] }>('banks', {});
      return Array.isArray(r.banks) && r.banks.length ? r.banks : NG_BANKS;
    } catch (err) {
        logWarn('api step 2 failed', err);
// The bank list is public reference data, so a static fallback is safe.
      return NG_BANKS;
    }
  }

  verifySalary(input: SalaryVerifyInput): Promise<SalaryVerifyResult> {
    return this.opOr<SalaryVerifyResult>('verify-salary', input, { status: 'service-down' });
  }

  verifyBvn(bvn: string, fullName: string, dateOfBirth: string): Promise<BvnVerifyResult> {
    return this.opOr<BvnVerifyResult>('verify-bvn', { bvn, fullName, dateOfBirth }, { status: 'service-down' });
  }

  verifyNin(nin: string, fullName: string, dateOfBirth: string): Promise<BvnVerifyResult> {
    return this.opOr<BvnVerifyResult>('verify-nin', { nin, fullName, dateOfBirth }, { status: 'service-down' });
  }

  async uploadDocument(input: DocUploadInput): Promise<DocUploadResult> {
    if (input.sizeBytes > MAX_UPLOAD_BYTES) return { status: 'too-large' };
    return this.opOr<DocUploadResult>('upload-document', input, { status: 'network' });
  }

  async createMandateLink(input: {
    productId: string;
    channel: 'ippis' | 'remita' | 'dedukt';
    monthlyAmount: number;
    tenorMonths: number;
  }): Promise<MandateLink> {
    const link = await this.op<MandateLink>(
      'mandate-link',
      input,
      this.idempotency.keyFor(`mandate:${input.productId}:${input.monthlyAmount}:${input.tenorMonths}`),
    );
    // Only ever offer the customer an https link, whatever the server returned.
    if (typeof link.url !== 'string' || !link.url.startsWith('https://') || typeof link.reference !== 'string') {
      throw new ApiUnavailableError('mandate-link', 502);
    }
    return link;
  }

  async getMandateStatus(reference: string): Promise<MandateStatus> {
    const r = await this.op<{ status: MandateStatus }>('mandate-status', { reference });
    return r.status === 'completed' || r.status === 'failed' ? r.status : 'pending';
  }

  async submitApplication(payload: SubmitPayload): Promise<SubmitResult> {
    if (!payload.loan) throw new ApiUnavailableError('missing-loan', 400);
    const r = await this.post<{ id?: unknown; error?: { code?: string } }>(
      '/api/submit-loan',
      payload.loan,
    );
    if (!r.ok || typeof r.data?.id !== 'string') {
      throw new ApiUnavailableError(r.data?.error?.code ?? 'submit', r.status);
    }
    // Caltos records the loan and decides; the browser never claims an outcome.
    return { status: 'received', referenceId: r.data.id };
  }

  async listLoans(): Promise<LoanSummary[]> {
    const r = await this.op<{ loans?: LoanSummary[] }>('list-loans', {});
    return Array.isArray(r.loans) ? r.loans : [];
  }

  async getOfferLetter(request: OfferLetterRequest): Promise<Uint8Array> {
    const r = await this.op<{ pdfBase64?: string }>('offer-letter', {
      productId: request.productId,
      amountKobo: Math.round(request.amount * 100),
      tenorMonths: request.tenorMonths,
    });
    if (typeof r.pdfBase64 !== 'string' || r.pdfBase64.length > MAX_LETTER_BASE64) throw new ApiUnavailableError('offer-letter', 502);
    const bytes = Uint8Array.from(atob(r.pdfBase64), (c) => c.charCodeAt(0));
    // Never hand the viewer anything that is not a PDF, whatever the server returned.
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new ApiUnavailableError('offer-letter', 502);
    return bytes;
  }

  async checkEligibility(input: EligibilityCheckInput): Promise<EligibilityCheckResult> {
    const r = await this.post<EligibilityCheckResult>('/api/selfserve/eligibility-check', input);
    // 429 is the limit on checks (per account and per address): the screen explains it in a window.
    if (r.status === 429) return { status: 'rate-limited' };
    if (!r.ok || !r.data) return { status: 'service-down' };
    return r.data;
  }

  async checkStatement(input: StatementCheckInput): Promise<EligibilityCheckResult> {
    const r = await this.post<EligibilityCheckResult>('/api/selfserve/statement-check', input);
    if (r.status === 429) return { status: 'rate-limited' };
    if (!r.ok || !r.data) return { status: 'service-down' };
    return r.data;
  }

  async registerPush(subscription: PushSubscriptionJSON): Promise<void> {
    const keys = subscription.keys ?? {};
    await this.op<{ status?: string }>('push-subscribe', {
      endpoint: subscription.endpoint,
      keys: { p256dh: keys['p256dh'], auth: keys['auth'] },
    });
  }

  async getEmploymentTypes(): Promise<EmploymentAvailability[] | null> {
    try {
      const res = await fetch('/api/employment-types', { credentials: 'same-origin', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      const data = (await res.json().catch(() => null)) as { types?: EmploymentAvailability[] } | null;
      return res.ok && Array.isArray(data?.types) ? data.types : null;
    } catch (err) {
      logWarn('employment types unavailable', err);
      return null;
    }
  }

  joinWaitlist(input: WaitlistInput): Promise<WaitlistResult> {
    return this.op<WaitlistResult>('waitlist', input, this.idempotency.keyFor(`waitlist:${input.type}`));
  }

  async checkReferral(code: string): Promise<ReferralDraft | null> {
    const r = await this.post<{ valid?: boolean; code?: string; rateDiscountPct?: number; label?: string }>('/api/referral', { code });
    const d = r.data;
    if (!r.ok || !d?.valid || typeof d.code !== 'string' || typeof d.rateDiscountPct !== 'number' || typeof d.label !== 'string') return null;
    return { code: d.code, rateDiscountPct: d.rateDiscountPct, label: d.label };
  }
}

/** Email is optional: an empty string means "not given", so it is left out of the request. */
function withoutEmptyEmail<B>(body: B): B {
  if (!body || typeof body !== 'object') return body;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (k === 'email' && v === '') continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? withoutEmptyEmail(v) : v;
  }
  return out as B;
}
