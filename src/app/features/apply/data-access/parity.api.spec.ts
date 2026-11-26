import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiOrigin } from '../../../core/api-origin';
import { applicationTokenInterceptor } from '../../../core/session/application-token.interceptor';
import { ApplicationSession } from '../../../core/session/application-session.service';
import { ParityApi } from './parity.api';

const origin = apiOrigin();
const application = `${origin}/api/v2/applications/app-id`;
const wrapped = (data: unknown) => ({
  statusCode: 200,
  code: 'SUCCESS',
  message: 'Success',
  data,
  status: 'success',
  timestamp: '2026-11-24T10:00:00.000Z',
});

describe('ParityApi backend handoff', () => {
  let api: ParityApi;
  let http: HttpTestingController;
  let session: ApplicationSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([applicationTokenInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(ParityApi);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(ApplicationSession);
  });

  afterEach(() => http.verify());

  it('sends the nested eligibility payload without an application token', async () => {
    session.establish('app-id', 'resume-token');
    const body = {
      employment: { type: 'federal' as const },
      bank: {
        bankCode: '058',
        accountNumber: '0123456789',
        accountName: 'ADA GRACE OKAFOR',
        ippisNumber: '123456',
      },
      identity: { bvn: '22349353546', firstName: 'Ada', lastName: 'Okafor' },
    };
    const response = api.previewEligibility(body);
    const request = http.expectOne({
      method: 'POST',
      url: `${origin}/api/v2/eligibility-preview`,
    });
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.has('x-application-resume-token')).toBe(false);
    request.flush(
      wrapped({
        decision: 'DECLINE',
        reasons: ['Monthly deduction limit reached.'],
        maximumAmount: 0,
        maximumTenor: 0,
        eligibleProducts: [],
      }),
    );
    await expect(response).resolves.toMatchObject({ decision: 'DECLINE', maximumAmount: 0 });
  });

  it('accepts mixed loan dates and a null mandate reference using the resume token', async () => {
    session.establish('app-id', 'resume-token');
    const summary = {
      id: 'Y2FsdG9zOmxvYW4tMQ',
      reference: 'PRC-7K2M9XQD',
      source: 'caltos',
      productName: 'State Salary Loan',
      status: 'open',
      principal: 200_000,
      balance: 120_000,
      monthlyRepayment: 25_000,
      disbursedAt: '2026-03-12',
      maturityDate: '2027-03-12',
    };
    const summaryWithoutDates = {
      ...summary,
      id: 'bG9hbmRpc2s6bG9hbi0y',
      reference: 'PRC-NULL-DATES',
      source: 'loandisk',
      status: 'closed',
      disbursedAt: null,
      maturityDate: null,
    };
    const listed = api.listLoans();
    const listRequest = http.expectOne({ method: 'GET', url: `${application}/loans` });
    expect(listRequest.request.headers.get('x-application-resume-token')).toBe('resume-token');
    listRequest.flush(wrapped({ loans: [summary, summaryWithoutDates] }));
    await expect(listed).resolves.toEqual({ loans: [summary, summaryWithoutDates] });

    const detailed = api.getLoan(summary.id);
    const detailRequest = http.expectOne({
      method: 'GET',
      url: `${application}/loans/${summary.id}`,
    });
    detailRequest.flush(
      wrapped({
        ...summary,
        repayment: {
          monthlyAmount: 25_000,
          totalRepayable: 240_000,
          totalPaid: 120_000,
          nextDueDate: '2026-12-25',
          schedule: [{ dueDate: '2026-12-25', amountDue: 25_000, amountPaid: 5_000 }],
        },
        mandates: [
          {
            provider: 'mono',
            kind: 'DIRECT_DEBIT',
            status: 'ACTIVE',
            externalId: null,
          },
        ],
      }),
    );
    await expect(detailed).resolves.toMatchObject({
      balance: 120_000,
      mandates: [{ externalId: null }],
    });
  });

  it('uses the exact waitlist, statement-review and NIN contracts', async () => {
    session.establish('app-id', 'resume-token');

    const waitlisted = api.joinWaitlist({ employmentType: 'private-sector' });
    const waitlistRequest = http.expectOne({ method: 'POST', url: `${application}/waitlist` });
    expect(waitlistRequest.request.body).toEqual({ employmentType: 'private-sector' });
    waitlistRequest.flush(
      wrapped({
        registered: true,
        created: true,
        employmentType: 'private-sector',
        registeredAt: '2026-11-24T10:00:00.000Z',
      }),
    );
    await expect(waitlisted).resolves.toMatchObject({ registered: true, created: true });

    const file = new File(['statement'], 'statement.pdf', { type: 'application/pdf' });
    const submitted = api.submitStatement(file, 'Acme Nigeria Limited', '058');
    const statementRequest = http.expectOne({
      method: 'POST',
      url: `${application}/statement-review`,
    });
    const form = statementRequest.request.body as FormData;
    expect(form.get('file')).toMatchObject({
      name: 'statement.pdf',
      type: 'application/pdf',
      size: file.size,
    });
    expect(form.get('employer')).toBe('Acme Nigeria Limited');
    expect(form.get('bankCode')).toBe('058');
    statementRequest.flush(
      wrapped({
        submitted: true,
        fileId: 'file-id',
        employer: 'Acme Nigeria Limited',
        bankCode: '058',
        status: 'UNDER_REVIEW',
      }),
    );
    await expect(submitted).resolves.toMatchObject({ fileId: 'file-id' });

    const verified = api.verifyNin('12345678901');
    const ninRequest = http.expectOne({ method: 'POST', url: `${application}/nin/verify` });
    expect(ninRequest.request.body).toEqual({ nin: '12345678901' });
    ninRequest.flush(wrapped({ verified: true, suggestedNext: 'profile' }));
    await expect(verified).resolves.toEqual({ verified: true, suggestedNext: 'profile' });
  });
});
