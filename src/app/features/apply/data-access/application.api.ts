import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { defer, firstValueFrom, map, Observable, takeUntil, timeout } from 'rxjs';
import type { z } from 'zod/mini';
import { apiOrigin } from '../../../core/api-origin';
import { ApplicationSession } from '../../../core/session/application-session.service';
import { parseApiResponse } from './api-response';
import { ApiError, apiError } from './api-error';
import * as ApplicationContract from './application-contract';

@Injectable({ providedIn: 'root' })
export class ApplicationApi {
  private readonly http = inject(HttpClient);
  private readonly session = inject(ApplicationSession);
  private requestResponse<Response>(
    method: string,
    path: string,
    schema: z.ZodMiniType<Response>,
    body?: unknown,
  ): Observable<Response> {
    return this.http
      .request<unknown>(method, apiOrigin() + '/api/v2/' + path, {
        body,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
      })
      .pipe(
        timeout(30_000),
        takeUntil(this.session.cancelled),
        map((response) => parseApiResponse(response, schema)),
      );
  }

  private request<Response>(
    method: string,
    path: string,
    schema: z.ZodMiniType<Response>,
    body?: unknown,
  ): Promise<Response> {
    return firstValueFrom(this.requestResponse(method, path, schema, body)).catch((error) => {
      throw apiError(error);
    });
  }

  private applicationPath(suffix = ''): string {
    const applicationId = this.session.applicationId();
    if (!applicationId)
      throw new ApiError('NO_SESSION', 'Please enter your BVN and verify your code again.');
    return 'applications/' + encodeURIComponent(applicationId) + suffix;
  }
  startApplication(body: ApplicationContract.StartApplicationDto) {
    return this.request(
      'POST',
      'applications',
      ApplicationContract.StartApplicationResponseDtoSchema,
      body,
    );
  }
  getApplication() {
    return this.request(
      'GET',
      this.applicationPath(),
      ApplicationContract.ApplicationViewDtoSchema,
    );
  }
  sendOtp(contactId: string, phoneNumber?: string) {
    const body: ApplicationContract.SendOtpDto = {
      contactId,
      ...(phoneNumber ? { phoneNumber } : {}),
    };
    return this.request(
      'POST',
      this.applicationPath('/otp/send'),
      ApplicationContract.SendOtpResponseDtoSchema,
      body,
    );
  }
  verifyOtp(code: string) {
    return this.request(
      'POST',
      this.applicationPath('/otp/verify'),
      ApplicationContract.ApplicationViewDtoSchema,
      { code },
    );
  }
  getUnreachableContactSupport() {
    return this.request(
      'POST',
      this.applicationPath('/contact-unreachable'),
      ApplicationContract.ContactUnreachableResponseDtoSchema,
      {},
    );
  }
  resetIdentity() {
    return this.request(
      'POST',
      this.applicationPath('/identity/reset'),
      ApplicationContract.ClosedResponseDtoSchema,
      {},
    );
  }
  getProfile() {
    return this.request(
      'GET',
      this.applicationPath('/profile'),
      ApplicationContract.ProfileFormResponseDtoSchema,
    );
  }
  saveProfile(body: ApplicationContract.ProfileDto) {
    return this.request(
      'PUT',
      this.applicationPath('/profile'),
      ApplicationContract.ProfileValuesDtoSchema,
      body,
    );
  }
  saveEmployment(body: ApplicationContract.EmploymentDto) {
    return this.request(
      'PUT',
      this.applicationPath('/employment'),
      ApplicationContract.EmploymentResponseDtoSchema,
      body,
    );
  }
  resolveBankAccount(body: ApplicationContract.ResolveAccountDto) {
    return defer(() =>
      this.requestResponse(
        'POST',
        this.applicationPath('/bank/resolve-account'),
        ApplicationContract.ResolveAccountResponseDtoSchema,
        body,
      ),
    );
  }
  saveSalary(body: ApplicationContract.SalaryDto) {
    return this.request(
      'PUT',
      this.applicationPath('/salary'),
      ApplicationContract.SalaryViewDtoSchema,
      body,
    );
  }
  checkEligibility() {
    return this.request(
      'POST',
      this.applicationPath('/eligibility'),
      ApplicationContract.OffersResponseDtoSchema,
      {},
    );
  }
  getOffers() {
    return this.request(
      'GET',
      this.applicationPath('/offers'),
      ApplicationContract.OffersResponseDtoSchema,
    );
  }
  requestQuote(body: ApplicationContract.QuoteDto, cancellation: Observable<void>) {
    return firstValueFrom(
      this.requestResponse(
        'POST',
        this.applicationPath('/quote'),
        ApplicationContract.QuoteResponseDtoSchema,
        body,
      ).pipe(takeUntil(cancellation)),
    );
  }
  selectOffer(body: ApplicationContract.QuoteDto) {
    return this.request(
      'POST',
      this.applicationPath('/offer/select'),
      ApplicationContract.LockedOfferDtoSchema,
      body,
    );
  }
  getOffer() {
    return this.request(
      'GET',
      this.applicationPath('/offer'),
      ApplicationContract.LockedOfferDtoSchema,
    );
  }
  completeTerms() {
    return this.request(
      'POST',
      this.applicationPath('/steps/terms/complete'),
      ApplicationContract.ApplicationViewDtoSchema,
      {},
    );
  }
  getDocuments() {
    return this.request(
      'GET',
      this.applicationPath('/documents'),
      ApplicationContract.DocumentStatusDtoSchema,
    );
  }
  async uploadDocument(
    file: File,
    documentType: ApplicationContract.PresignDocumentDto['documentType'],
  ): Promise<ApplicationContract.DocumentStatusDto> {
    const generation = this.session.generation();
    const signed = await this.request(
      'POST',
      this.applicationPath('/documents/presign'),
      ApplicationContract.PresignDocumentResponseDtoSchema,
      { fileName: file.name, contentType: file.type, sizeBytes: file.size, documentType },
    );
    if (new URL(signed.uploadUrl).protocol !== 'https:')
      throw new ApiError('INVALID_UPLOAD_URL', 'The upload address is invalid.');
    if (this.session.generation() !== generation)
      throw new ApiError('SESSION_CHANGED', 'Please start again.');
    await firstValueFrom(
      this.http
        .put(signed.uploadUrl, file, {
          headers: signed.uploadHeaders,
          responseType: 'text',
          credentials: 'omit',
          redirect: 'error',
        })
        .pipe(timeout(120_000), takeUntil(this.session.cancelled)),
    ).catch((error) => {
      throw apiError(error);
    });
    if (this.session.generation() !== generation)
      throw new ApiError('SESSION_CHANGED', 'Please start again.');
    return this.getDocuments();
  }
  getIdentityStatus() {
    return this.request(
      'GET',
      this.applicationPath('/identity'),
      ApplicationContract.IdentityStatusDtoSchema,
    );
  }
  startIdentityVerification() {
    return this.request(
      'POST',
      this.applicationPath('/identity/start'),
      ApplicationContract.IdentityStatusDtoSchema,
    );
  }
  cancelApplication(body: ApplicationContract.CancelApplicationDto = {}) {
    return this.request(
      'POST',
      this.applicationPath('/cancel'),
      ApplicationContract.CancelledResponseDtoSchema,
      body,
    );
  }
  getOfferLetter() {
    return this.request(
      'GET',
      this.applicationPath('/offer-letter'),
      ApplicationContract.OfferLetterResponseDtoSchema,
    );
  }
  acceptOfferLetter(hash: string) {
    return this.request(
      'POST',
      this.applicationPath('/offer-letter/accept'),
      ApplicationContract.AcceptOfferLetterResponseDtoSchema,
      { hash },
    );
  }
  mandates(create = false) {
    return this.request(
      create ? 'POST' : 'GET',
      this.applicationPath('/mandates'),
      ApplicationContract.MandatesResponseDtoSchema,
      create ? {} : undefined,
    );
  }
  submitApplication() {
    return this.request(
      'POST',
      this.applicationPath('/submit'),
      ApplicationContract.SubmissionStatusDtoSchema,
    );
  }
  getSubmissionStatus() {
    return this.request(
      'GET',
      this.applicationPath('/status'),
      ApplicationContract.SubmissionStatusDtoSchema,
    );
  }
}
