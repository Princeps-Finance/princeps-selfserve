import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_CLIENT, Quote, QuoteResult } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { QUOTE_DEBOUNCE_MS } from '../../../core/pricing/quote.service';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { buildQuote } from '../../../../shared/quote';
import { pricingProductById } from '../../../../shared/pricing';
import { OffersComponent } from './offers.component';

function serverQuote(amount: number, tenor: number): Quote {
  return buildQuote(pricingProductById('ippis-standard')!, amount, tenor, 5, 'q-' + amount);
}

async function setup(getQuote: (i: { amount: number; tenorMonths: number }) => Promise<QuoteResult>) {
  vi.useFakeTimers();
  const go = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: FlowNavigator, useValue: { go, next: vi.fn() } },
      { provide: API_CLIENT, useValue: { getQuote: vi.fn(getQuote), checkReferral: vi.fn() } },
    ],
  });
  const state = TestBed.inject(ApplicationStateService);
  state.setEmployment({ type: 'government', governmentLevel: 'federal' });
  state.setSalary({ channel: 'ippis', monthlyIncome: 180_000 } as never);
  state.setEligibility({ score: 80, decision: 'approved', maxEligibleAmount: 300_000, tenorMonths: 12, reasons: [] });
  const fixture = TestBed.createComponent(OffersComponent);
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(0);
  const comp = fixture.componentInstance;
  comp.select('ippis-standard');
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async (ms = QUOTE_DEBOUNCE_MS + 50) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  return { comp, el, state, go, fixture, settle };
}

describe('OffersComponent with the server quote', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps the button off, with an estimate on show, until the server has priced the loan', async () => {
    const { el, settle, comp } = await setup(async (i) => ({ status: 'ok', quote: serverQuote(i.amount, i.tenorMonths) }));
    const cta = () => el.querySelector<HTMLButtonElement>('button.cta')!;
    expect(cta().disabled).toBe(true);
    expect(el.querySelector('.quote-line--est')).not.toBeNull();
    await settle();
    expect(cta().disabled).toBe(false);
    expect(el.querySelector('.quote-line--est')).toBeNull();
    expect(el.querySelector('.quote-line strong')?.textContent).toContain('₦');
    expect(comp.quoteReady()).toBe(true);
  });

  it('takes the server\'s figures, with the quote id, into the application', async () => {
    const { el, settle, state, go } = await setup(async (i) => ({ status: 'ok', quote: serverQuote(i.amount, i.tenorMonths) }));
    await settle();
    el.querySelector<HTMLButtonElement>('button.cta')!.click();
    expect(state.offer()?.quote?.quoteId).toMatch(/^q-/);
    expect(state.offer()?.monthlyRepayment).toBe(state.offer()?.quote?.monthlyRepayment);
    expect(go).toHaveBeenCalledWith(APPLY.terms);
  });

  it('cannot continue when the server cannot be reached, says so, and lets the customer try again', async () => {
    let up = false;
    const { el, settle, fixture, comp, state } = await setup(async (i) => (up ? { status: 'ok', quote: serverQuote(i.amount, i.tenorMonths) } : { status: 'unavailable' }));
    await settle();
    expect(el.querySelector<HTMLButtonElement>('button.cta')!.disabled).toBe(true);
    expect(el.querySelector('.quote-error')).not.toBeNull();
    comp.pick(comp.selected()!);
    expect(state.offer()).toBeNull();
    up = true;
    el.querySelector<HTMLButtonElement>('.quote button.alt')!.click();
    await settle(10);
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('button.cta')!.disabled).toBe(false);
  });

  it('shows the estimate again and waits for a new answer when the amount changes', async () => {
    const { el, settle, comp } = await setup(async (i) => ({ status: 'ok', quote: serverQuote(i.amount, i.tenorMonths) }));
    await settle();
    comp.setAmount(comp.selected()!, 150_000);
    TestBed.tick();
    expect(comp.quoteReady()).toBe(false);
    expect(el.querySelector<HTMLButtonElement>('button.cta')!.disabled).toBe(true);
    await settle();
    expect(comp.quoteReady()).toBe(true);
  });
});
