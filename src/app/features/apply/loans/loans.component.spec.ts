import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiOrigin } from '../../../core/api-origin';
import { ApplicationSession } from '../../../core/session/application-session.service';
import { LoansComponent } from './loans.component';

const loansUrl = `${apiOrigin()}/api/v2/applications/app-id/loans`;
const partialMessage = 'We could not load your full loan history. Some loans may be missing.';
const emptyMessage = 'You do not have any loans to show yet.';
const availability = { caltos: 'available', loandisk: 'unavailable' };

function wrapped(data: unknown) {
  return { statusCode: 200, status: 'success', code: 'SUCCESS', data };
}

async function renderLoadedHistory(fixture: ComponentFixture<LoansComponent>) {
  await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
  fixture.detectChanges();
}

describe('LoansComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(ApplicationSession).establish('app-id', 'resume-token');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('shows an incomplete history for zero partial results and the empty state after a complete retry', async () => {
    const fixture = TestBed.createComponent(LoansComponent);
    fixture.detectChanges();
    const screen = fixture.nativeElement as HTMLElement;
    const partialResponse = { loans: [], partial: true, availability };
    http.expectOne({ method: 'GET', url: loansUrl }).flush(wrapped(partialResponse));
    await renderLoadedHistory(fixture);

    expect(fixture.componentInstance.data()).toEqual(partialResponse);
    expect(screen.querySelector('[role="status"]')?.textContent).toContain(partialMessage);
    expect(screen.textContent).not.toContain(emptyMessage);

    const retry = screen.querySelector<HTMLButtonElement>('.state button')!;
    expect(retry.textContent?.trim()).toBe('Try again');
    retry.click();
    http.expectOne({ method: 'GET', url: loansUrl }).flush(wrapped({ loans: [], partial: false }));
    await renderLoadedHistory(fixture);

    expect(screen.textContent).toContain(emptyMessage);
    expect(screen.textContent).not.toContain(partialMessage);
    expect(screen.querySelector('.state button')).toBeNull();
  });

  it('keeps the loans returned by an available ledger visible during and after a failed retry', async () => {
    const fixture = TestBed.createComponent(LoansComponent);
    fixture.detectChanges();
    const screen = fixture.nativeElement as HTMLElement;
    const loan = {
      id: 'loan-id',
      reference: 'PRC-1234',
      source: 'caltos',
      productName: 'State Salary Loan',
      status: 'open',
      principal: 200_000,
      balance: 120_000,
      monthlyRepayment: 25_000,
      disbursedAt: null,
      maturityDate: null,
    };
    http
      .expectOne({ method: 'GET', url: loansUrl })
      .flush(wrapped({ loans: [loan], partial: true, availability }));
    await renderLoadedHistory(fixture);

    expect(screen.querySelector('[role="status"]')?.textContent).toContain(partialMessage);
    expect(screen.querySelector('.loan')?.textContent).toContain(loan.productName);
    expect(screen.textContent).not.toContain(emptyMessage);

    const retry = screen.querySelector<HTMLButtonElement>('.state button')!;
    retry.click();
    fixture.detectChanges();
    expect(retry.disabled).toBe(true);
    expect(screen.querySelector('.loan')?.textContent).toContain(loan.productName);

    http
      .expectOne({ method: 'GET', url: loansUrl })
      .flush(null, { status: 503, statusText: 'Service unavailable' });
    await renderLoadedHistory(fixture);

    expect(screen.querySelector('[role="alert"]')?.textContent).toContain(partialMessage);
    expect(screen.querySelector('.loan')?.textContent).toContain(loan.productName);
    expect(retry.disabled).toBe(false);
  });
});
