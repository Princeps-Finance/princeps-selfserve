import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { APP_CONFIG } from '../../../runtime-config';
import { ApplicationStore, stepRoutes } from '../state/application.store';
import { ApplicationSession } from '../../../core/session/application-session.service';
import { VerificationComponent } from './verification.component';

describe('BVN form', () => {
  it('does not contact the backend with an invalid BVN or without consent', async () => {
    TestBed.configureTestingModule({
      imports: [VerificationComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { page: 'bvn' } } } },
        {
          provide: APP_CONFIG,
          useValue: {
            environment: 'development',
            apiBaseUrl: 'https://api.example.test',
            accountsUrl: '',
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(VerificationComponent);
    await fixture.whenStable();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const input = form.querySelector('input[formControlName="bvn"]') as HTMLInputElement;
    const consent = form.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const http = TestBed.inject(HttpTestingController);
    const submit = () =>
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    const changeBvn = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };

    consent.click();
    changeBvn('000');
    submit();
    http.expectNone(() => true);
    await fixture.whenStable();
    expect(form.querySelector('[role="alert"]')?.textContent).toContain('11');
    consent.click();
    changeBvn('00000000000');
    submit();
    http.expectNone(() => true);
    consent.click();
    submit();
    const request = http.expectOne({
      method: 'POST',
      url: 'https://api.example.test/api/v2/applications',
    });
    expect(request.request.body).toMatchObject({
      bvn: '00000000000',
      consent: true,
      noticeVersion: expect.any(String),
    });
    request.flush({ code: 'BVN_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    http.verify();
  });

  it('prevents native OTP submission so the code never goes in the URL', async () => {
    TestBed.configureTestingModule({
      imports: [VerificationComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { page: 'verify' } } } },
        {
          provide: APP_CONFIG,
          useValue: {
            environment: 'development',
            apiBaseUrl: 'https://api.example.test',
            accountsUrl: '',
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(VerificationComponent);
    const store = TestBed.inject(ApplicationStore);
    TestBed.inject(ApplicationSession).establish('test-id', 'fixture-token');
    store.setApplication({
      id: 'test-id',
      status: 'DRAFT',
      reference: null,
      suggestedNext: 'verification',
      returningCustomer: false,
      otpVerified: false,
      createdAt: '',
      updatedAt: '',
      contacts: [{ id: 'phone', type: 'phone', masked: '***1234' }],
      steps: Object.fromEntries(
        Object.keys(stepRoutes).map((key, index) => [key, { step: index + 1, status: 'PENDING' }]),
      ) as NonNullable<ReturnType<typeof store.application>>['steps'],
    });
    const http = TestBed.inject(HttpTestingController);
    const sending = store.sendCode({ contactId: 'phone' });
    http
      .expectOne('https://api.example.test/api/v2/applications/test-id/otp/send')
      .flush({ channel: 'sms', expiresAt: '2026-11-13T00:05:00Z', resendAfterSeconds: 30 });
    await sending;
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector(
      'input[autocomplete="one-time-code"]',
    ) as HTMLInputElement;
    input.value = '000000';
    input.dispatchEvent(new Event('input'));
    const event = new Event('submit', { bubbles: true, cancelable: true });
    input.form!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const verify = http.expectOne({
      method: 'POST',
      url: 'https://api.example.test/api/v2/applications/test-id/otp/verify',
    });
    expect(verify.request.body).toEqual({ code: '000000' });
    verify.flush({ code: 'OTP_WRONG' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    http.verify();
  });
});
