import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, map, takeUntil, timeout } from 'rxjs';
import type { z } from 'zod/mini';
import { apiOrigin } from '../../../core/api-origin';
import { ApplicationSession } from '../../../core/session/application-session.service';
import { apiError, ApiError } from './api-error';
import { parseApiResponse } from './api-response';
import {
  EligibilityPreviewRequest,
  EligibilityPreviewResponseSchema,
  LoanDetailSchema,
  LoansResponseSchema,
  NinVerificationResponseSchema,
  StatementReviewResponseSchema,
  WaitlistRequest,
  WaitlistResponseSchema,
} from './parity-contract';

/**
 * API boundary for screens present in the Cloudflare reference but not yet covered by the
 * pinned v2 application contract. Keeping these calls separate prevents provisional contracts
 * from weakening the generated core contract.
 */
@Injectable({ providedIn: 'root' })
export class ParityApi {
  private readonly http = inject(HttpClient);
  private readonly session = inject(ApplicationSession);

  private applicationPath(suffix: string): string {
    const id = this.session.applicationId();
    if (!id) throw new ApiError('NO_SESSION', 'Please enter your BVN and verify your code again.');
    return `${apiOrigin()}/api/v2/applications/${encodeURIComponent(id)}${suffix}`;
  }

  private request<T>(method: string, url: string, schema: z.ZodMiniType<T>, body?: unknown) {
    return firstValueFrom(
      this.http
        .request<unknown>(method, url, {
          body,
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
        })
        .pipe(
          timeout(30_000),
          takeUntil(this.session.cancelled),
          map((response) => parseApiResponse(response, schema)),
        ),
    ).catch((error) => {
      throw apiError(error);
    });
  }

  listLoans() {
    return this.request('GET', this.applicationPath('/loans'), LoansResponseSchema);
  }

  getLoan(id: string) {
    return this.request(
      'GET',
      this.applicationPath(`/loans/${encodeURIComponent(id)}`),
      LoanDetailSchema,
    );
  }

  joinWaitlist(body: WaitlistRequest) {
    return this.request('POST', this.applicationPath('/waitlist'), WaitlistResponseSchema, body);
  }

  submitStatement(file: File, employer: string, bankCode: string) {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('employer', employer);
    body.append('bankCode', bankCode);
    return this.request(
      'POST',
      this.applicationPath('/statement-review'),
      StatementReviewResponseSchema,
      body,
    );
  }

  previewEligibility(body: EligibilityPreviewRequest) {
    return this.request(
      'POST',
      `${apiOrigin()}/api/v2/eligibility-preview`,
      EligibilityPreviewResponseSchema,
      body,
    );
  }

  verifyNin(nin: string) {
    return this.request(
      'POST',
      this.applicationPath('/nin/verify'),
      NinVerificationResponseSchema,
      { nin },
    );
  }
}
