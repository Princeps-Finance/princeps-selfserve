import { apiOrigin } from '../../../core/api-origin';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { applicationTokenInterceptor } from '../../../core/session/application-token.interceptor';
import {
  ApplicationSession,
  clearLegacyCustomerStorage,
} from '../../../core/session/application-session.service';
import { ReferenceDataStore } from './reference-data.store';
import { verifiedGuard } from '../../../app.guards';
import { ApplicationStore, stepRoutes } from '../state/application.store';
import { OffersStore } from '../state/offers.store';
import { ApplicationApi } from './application.api';

const origin = apiOrigin();
const base = origin + '/api/v2';
const application = base + '/applications/id';
const wrapped = (data: unknown) => ({ status: 'success', statusCode: 200, code: 'SUCCESS', data });
const resumeHeader = 'x-application-resume-token';
const app = {
  id: 'id',
  status: 'DRAFT',
  reference: null,
  suggestedNext: 'employment',
  returningCustomer: true,
  otpVerified: true,
  createdAt: '2026-11-13',
  updatedAt: '2026-11-13',
  steps: Object.fromEntries(
    Object.keys(stepRoutes).map((step, index) => [step, { step: index + 1, status: 'PENDING' }]),
  ),
};
const documentStatus = {
  documents: [],
  required: ['gov-id'],
  missing: ['gov-id'],
  identityDone: false,
  digisignAvailable: false,
  identityRequired: [],
  identityMissing: [],
};

describe('v2 browser integration', () => {
  let http: HttpTestingController;
  let api: ApplicationApi;
  let session: ApplicationSession;
  let store: InstanceType<typeof ApplicationStore>;
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([applicationTokenInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ApplicationApi);
    session = TestBed.inject(ApplicationSession);
    store = TestBed.inject(ApplicationStore);
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('requires OTP in this visit, follows the returned next step, and forgets the session on reset', async () => {
    const guard = () =>
      TestBed.runInInjectionContext(() => verifiedGuard({ path: 'employment' }, []));
    const url = (value: ReturnType<typeof guard>) =>
      TestBed.inject(Router).serializeUrl(value as never);
    expect(url(guard())).toBe('/apply/bvn');
    const started = store.start({ bvn: '00000000000', consent: true });
    const start = http.expectOne({ method: 'POST', url: base + '/applications' });
    expect(start.request.headers.has(resumeHeader)).toBe(false);
    expect(start.request.cache).toBe('no-store');
    start.flush(wrapped({ ...app, resumeToken: 'fixture-token', resumed: true }));
    expect(await started).toBe(true);
    expect(url(guard())).toBe('/apply/verify');
    expect(store.application()).not.toHaveProperty('resumeToken');
    const verified = store.verify('000000');
    const verify = http.expectOne({ method: 'POST', url: application + '/otp/verify' });
    expect(verify.request.body).toEqual({ code: '000000' });
    expect(verify.request.headers.get(resumeHeader)).toBe('fixture-token');
    verify.flush(app);
    expect(await verified).toBe(true);
    expect(guard()).toBe(true);
    expect(store.nextRoute()).toBe('/apply/employment');
    expect(localStorage.length + sessionStorage.length).toBe(0);
    store.reset();
    expect(url(guard())).toBe('/apply/bvn');
    expect(store.application()).toBeNull();
    expect(session.tokenFor('id')).toBeNull();
  });

  it('cancels in-flight application requests and clears state on an invalid token', async () => {
    session.establish('id', 'expired');
    const inFlight = store.run('profile', () => api.getProfile());
    const profile = http.expectOne(application + '/profile');
    const request = store.run('view', () => api.getApplication());
    http
      .expectOne(application)
      .flush({ code: 'INVALID_TOKEN' }, { status: 401, statusText: 'Unauthorized' });
    expect(await request).toBeNull();
    expect(await inFlight).toBeNull();
    expect(profile.cancelled).toBe(true);
    expect(session.applicationId()).toBeNull();
    expect(store.pending()).toEqual({});
  });

  it('uploads actual file bytes with signed headers and no resume token before refreshing status', async () => {
    session.establish('id', 'fixture-token');
    const file = new File([new Uint8Array(2048)], 'id.pdf', { type: 'application/pdf' });
    const uploadUrl = 'https://bucket.s3.amazonaws.com/file?X-Amz-Signature=fixture';
    const uploaded = api.uploadDocument(file, 'gov-id');
    const sign = http.expectOne({ method: 'POST', url: application + '/documents/presign' });
    expect(sign.request.body).toEqual({
      fileName: 'id.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      documentType: 'gov-id',
    });
    sign.flush({
      fileId: 'id-file',
      uploadUrl,
      uploadMethod: 'PUT',
      uploadHeaders: { 'Content-Type': 'application/pdf' },
      expiresIn: 900,
      status: documentStatus,
    });
    await Promise.resolve();
    await Promise.resolve();
    const upload = http.expectOne({ method: 'PUT', url: uploadUrl });
    expect(upload.request.body).toBe(file);
    expect(upload.request.headers.has(resumeHeader)).toBe(false);
    expect(upload.request.headers.get('Content-Type')).toBe('application/pdf');
    http.expectNone(application + '/documents');
    upload.flush('');
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne(application + '/documents').flush({ ...documentStatus, missing: [] });
    expect((await uploaded).missing).toEqual([]);
  });

  it('sends the letter hash and exposes a changed-letter conflict', async () => {
    session.establish('id', 'fixture-token');
    const accepted = api.acceptOfferLetter('version-read');
    const post = http.expectOne(application + '/offer-letter/accept');
    expect(post.request.body).toEqual({ hash: 'version-read' });
    post.flush(
      { code: 'OFFER_LETTER_CHANGED', message: 'Read the new version.' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(accepted).rejects.toMatchObject({ code: 'OFFER_LETTER_CHANGED' });
  });

  it('aborts a bank lookup when the consumer leaves or changes the account', () => {
    session.establish('id', 'fixture-token');
    const lookup = api
      .resolveBankAccount({ bankCode: '044', accountNumber: '0000001234' })
      .subscribe();
    const request = http.expectOne(application + '/bank/resolve-account');
    lookup.unsubscribe();
    expect(request.cancelled).toBe(true);
  });

  it('cancels the previous quote when the amount changes', async () => {
    session.establish('id', 'fixture-token');
    const offers = TestBed.inject(OffersStore);
    const quote = (amount: number) =>
      offers.requestQuote({ productId: 'p1', amount, tenorMonths: 6 });
    const older = quote(200000);
    const oldRequest = http.expectOne(application + '/quote');
    offers.invalidateQuote();
    const newer = quote(100000);
    http.expectOne(application + '/quote').flush({ eligible: true, amount: 100000 });
    await newer;
    expect(oldRequest.cancelled).toBe(true);
    await older;
    expect(offers.quote()).toMatchObject({ eligible: true, amount: 100000 });
  });

  it('shares public lookups, expires them, and does not cache malformed responses', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const reference = TestBed.inject(ReferenceDataStore);
    session.establish('id', 'fixture-token');
    const first = reference.banks(),
      second = reference.banks();
    const request = http.expectOne(base + '/banks');
    expect(request.request.headers.has(resumeHeader)).toBe(false);
    request.flush(wrapped([{ code: '001', name: 'Test bank' }]));
    expect(await first).toEqual(await second);
    expect(
      JSON.parse(localStorage.getItem('princeps.public.v2:' + origin + ':banks')!).value,
    ).toEqual(await first);
    expect(await reference.banks()).toEqual(await first);
    now.mockReturnValue(86_410_000);
    const expired = reference.banks();
    http.expectOne(base + '/banks').flush([{ code: 2, name: 'Malformed' }]);
    await expect(expired).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    const retried = reference.banks();
    http.expectOne(base + '/banks').flush([{ code: '002', name: 'New bank' }]);
    expect(await retried).toEqual([{ code: '002', name: 'New bank' }]);
  });

  it('sends the alternate phone to Mono and reads error details from the envelope', async () => {
    session.establish('id', 'fixture-token');
    const sent = api.sendOtp('mono-alternate_phone', '08012345678');
    const request = http.expectOne({ method: 'POST', url: application + '/otp/send' });
    expect(request.request.body).toEqual({
      contactId: 'mono-alternate_phone',
      phoneNumber: '08012345678',
    });
    request.flush(
      {
        statusCode: 429,
        code: 'OTP_RESEND_TOO_SOON',
        message: 'Wait before resending.',
        status: 'error',
        timestamp: '2026-11-14T09:00:00Z',
        data: { retryAfterSeconds: 17 },
      },
      { status: 429, statusText: 'Too Many Requests' },
    );
    await expect(sent).rejects.toMatchObject({
      code: 'OTP_RESEND_TOO_SOON',
      status: 429,
      retryAfterSeconds: 17,
      details: { retryAfterSeconds: 17 },
    });
  });

  it('loads and starts DigiSign without sending a request body, and rejects insecure signing links', async () => {
    session.establish('id', 'fixture-token');
    const started = api.startIdentityVerification();
    const post = http.expectOne({ method: 'POST', url: application + '/identity/start' });
    expect(post.request.body).toBeNull();
    post.flush(
      wrapped({
        digisignAvailable: true,
        status: 'PENDING',
        done: false,
        signingUrl: 'https://sandbox.usedigisign.dev/sign/fixture',
      }),
    );
    await expect(started).resolves.toMatchObject({ status: 'PENDING', done: false });
    const checking = api.getIdentityStatus();
    http
      .expectOne({ method: 'GET', url: application + '/identity' })
      .flush(wrapped({ digisignAvailable: true, status: 'VERIFIED', done: true, via: 'digisign' }));
    await expect(checking).resolves.toMatchObject({ done: true, via: 'digisign' });
    const invalid = api.getIdentityStatus();
    http.expectOne(application + '/identity').flush(
      wrapped({
        digisignAvailable: true,
        status: 'PENDING',
        done: false,
        signingUrl: 'http://example.test',
      }),
    );
    await expect(invalid).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('reads cancellation and provider revocation results and accepts the CANCELLED status', async () => {
    session.establish('id', 'fixture-token');
    const result = api.cancelApplication({ reason: 'No longer needed' });
    const request = http.expectOne({ method: 'POST', url: application + '/cancel' });
    expect(request.request.headers.get(resumeHeader)).toBe('fixture-token');
    expect(request.request.body).toEqual({ reason: 'No longer needed' });
    request.flush(
      wrapped({
        cancelled: true,
        cancelledAt: '2026-11-14T09:00:00Z',
        mandatesNeedingRevocation: [{ provider: 'mono', externalId: 'provider-fixture' }],
      }),
    );
    await expect(result).resolves.toMatchObject({
      cancelled: true,
      mandatesNeedingRevocation: [{ provider: 'mono' }],
    });
    const status = api.getSubmissionStatus();
    http.expectOne(application + '/status').flush(
      wrapped({
        status: 'CANCELLED',
        reference: null,
        manualReview: false,
        reviewReasons: [],
        pendingSteps: [],
        loanId: null,
      }),
    );
    await expect(status).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  it('removes old customer data while preserving language and theme preferences', () => {
    localStorage.setItem('princeps.draft', '{"bvn":"test"}');
    sessionStorage.setItem('princeps.check-progress', '{}');
    localStorage.setItem('princeps.lang', 'yo');
    localStorage.setItem('princeps.theme', 'dark');
    clearLegacyCustomerStorage();
    expect(localStorage.getItem('princeps.draft')).toBeNull();
    expect(sessionStorage.getItem('princeps.check-progress')).toBeNull();
    expect(localStorage.getItem('princeps.lang')).toBe('yo');
    expect(localStorage.getItem('princeps.theme')).toBe('dark');
  });
});
