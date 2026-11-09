import { Injectable } from '@angular/core';
import {
  ApiClient,
  Bank,
  BvnVerifyResult,
  DocUploadInput,
  DocUploadResult,
  LookupResult,
  MandateLink,
  MandateStatus,
  NG_BANKS,
  SalaryVerifyInput,
  SalaryVerifyResult,
  SubmitPayload,
  SubmitResult,
  WaitlistInput,
  WaitlistResult,
} from './api-client';

/** The service could not be reached or returned something unusable. */
export class ApiUnavailableError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
  ) {
    super(`API unavailable: ${code}`);
  }
}

const TIMEOUT_MS = 15_000;

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
@Injectable({ providedIn: 'root' })
export class HttpApiClient implements ApiClient {
  private token: string | null = null;

  private async post<T>(path: string, body: unknown): Promise<Reply<T>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['X-Application-Token'] = this.token;
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        credentials: 'same-origin',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = (await res.json().catch(() => null)) as T | null;
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: null };
    }
  }

  private async op<T>(name: string, body: unknown): Promise<T> {
    const r = await this.post<T>(`/api/selfserve/${name}`, body);
    if (!r.ok || r.data === null) throw new ApiUnavailableError(name, r.status);
    return r.data;
  }

  lookupContact(input: { phone: string; email: string }): Promise<LookupResult> {
    return this.op<LookupResult>('lookup-contact', input);
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
    } catch {
      // The bank list is public reference data, so a static fallback is safe.
      return NG_BANKS;
    }
  }

  async verifySalary(input: SalaryVerifyInput): Promise<SalaryVerifyResult> {
    try {
      return await this.op<SalaryVerifyResult>('verify-salary', input);
    } catch {
      return { status: 'service-down' };
    }
  }

  async verifyBvn(bvn: string, fullName: string, dateOfBirth: string): Promise<BvnVerifyResult> {
    try {
      return await this.op<BvnVerifyResult>('verify-bvn', { bvn, fullName, dateOfBirth });
    } catch {
      return { status: 'service-down' };
    }
  }

  async verifyNin(nin: string, fullName: string, dateOfBirth: string): Promise<BvnVerifyResult> {
    try {
      return await this.op<BvnVerifyResult>('verify-nin', { nin, fullName, dateOfBirth });
    } catch {
      return { status: 'service-down' };
    }
  }

  async uploadDocument(input: DocUploadInput): Promise<DocUploadResult> {
    if (input.sizeBytes > 10 * 1024 * 1024) return { status: 'too-large' };
    try {
      return await this.op<DocUploadResult>('upload-document', input);
    } catch {
      return { status: 'network' };
    }
  }

  async createMandateLink(input: {
    productId: string;
    channel: 'ippis' | 'remita' | 'dedukt';
    monthlyAmount: number;
    tenorMonths: number;
  }): Promise<MandateLink> {
    const link = await this.op<MandateLink>('mandate-link', input);
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

  joinWaitlist(input: WaitlistInput): Promise<WaitlistResult> {
    return this.op<WaitlistResult>('waitlist', input);
  }
}
