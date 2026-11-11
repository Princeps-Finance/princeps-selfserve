import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_CLIENT, Quote, QuoteResult } from '../api/api-client';
import { ApplicationStateService } from '../application/application-state.service';
import { APPLY } from '../flow/apply-routes';
import { FlowNavigator } from '../flow/flow-navigator.service';
import { QUOTE_DEBOUNCE_MS, QuoteService, offerFromQuote, quoteKey } from './quote.service';

const input = (amount: number, tenor = 6) => ({ productId: 'ippis-standard', amount, tenorMonths: tenor });

function quote(over: Partial<Quote> = {}): Quote {
  return {
    quoteId: 'q-' + Math.random(), expiresAt: new Date(Date.now() + 3_600_000).toISOString(), productId: 'ippis-standard', amount: 200_000, tenorMonths: 6,
    ratePercent: 5, interestModel: 'Flat Rate', monthlyRepayment: 35_000, fees: [], totalFees: 0, totalInterest: 10_000, totalRepayable: 210_000,
    firstDueDate: '2026-12-24', schedule: [], ...over,
  };
}

function setup(getQuote: (i: unknown) => Promise<QuoteResult>) {
  const go = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: API_CLIENT, useValue: { getQuote: vi.fn(getQuote) } }, { provide: FlowNavigator, useValue: { go } }] });
  return { svc: TestBed.inject(QuoteService), state: TestBed.inject(ApplicationStateService), api: TestBed.inject(API_CLIENT) as unknown as { getQuote: ReturnType<typeof vi.fn> }, go };
}

describe('QuoteService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('asks the server once after the customer stops moving the slider', async () => {
    const { svc, api } = setup(async (i) => ({ status: 'ok', quote: quote({ amount: (i as { amount: number }).amount }) }));
    svc.request(input(100_000));
    svc.request(input(150_000));
    svc.request(input(200_000));
    expect(svc.viewFor('ippis-standard', input(200_000))?.status).toBe('loading');
    expect(api.getQuote).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS + 10);
    expect(api.getQuote).toHaveBeenCalledTimes(1);
    expect(svc.viewFor('ippis-standard', input(200_000))).toMatchObject({ status: 'ready' });
  });

  it('never shows an answer for older terms as the current one', async () => {
    const releases: ((r: QuoteResult) => void)[] = [];
    const { svc } = setup(() => new Promise<QuoteResult>((r) => releases.push(r)));
    svc.request(input(100_000), { immediately: true });
    svc.request(input(200_000), { immediately: true });
    releases[0]({ status: 'ok', quote: quote({ amount: 100_000 }) }); // the answer for the older terms arrives late
    await vi.advanceTimersByTimeAsync(0);
    expect(svc.viewFor('ippis-standard', input(100_000))).toBeNull();
    expect(svc.viewFor('ippis-standard', input(200_000))?.status).toBe('loading');
  });

  it('reports a failed or refused answer, and lets the customer ask again', async () => {
    let n = 0;
    const { svc } = setup(async () => (++n === 1 ? { status: 'unavailable' } : n === 2 ? { status: 'invalid' } : { status: 'ok', quote: quote() }));
    svc.request(input(200_000), { immediately: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(svc.viewFor('ippis-standard', input(200_000))?.status).toBe('error');
    svc.request(input(200_000), { immediately: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(svc.viewFor('ippis-standard', input(200_000))?.status).toBe('invalid');
    svc.request(input(200_000), { immediately: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(svc.viewFor('ippis-standard', input(200_000))?.status).toBe('ready');
  });

  describe('before a later step relies on the accepted quote', () => {
    it('leaves a quote that is still valid alone', async () => {
      const { svc, state, api } = setup(async () => ({ status: 'unavailable' }));
      state.setOffer(offerFromQuote(quote(), 'Standard'));
      expect(await svc.confirm()).toBe(true);
      expect(api.getQuote).not.toHaveBeenCalled();
    });

    it('renews an expired quote quietly when the figures are the same, keeping what the customer accepted', async () => {
      const fresh = quote({ quoteId: 'new' });
      const { svc, state } = setup(async () => ({ status: 'ok', quote: fresh }));
      state.setOffer(offerFromQuote(quote({ expiresAt: new Date(Date.now() - 1000).toISOString() }), 'Standard'));
      state.setTermsAccepted('2026-11-11T10:00:00Z');
      expect(await svc.confirm()).toBe(true);
      expect(state.offer()?.quote?.quoteId).toBe('new');
      expect(state.termsAcceptedAt()).not.toBeNull();
    });

    it('sends the customer back to the terms when the figures changed', async () => {
      const { svc, state, go } = setup(async () => ({ status: 'ok', quote: quote({ monthlyRepayment: 40_000, totalRepayable: 240_000 }) }));
      state.setOffer(offerFromQuote(quote({ expiresAt: new Date(Date.now() - 1000).toISOString() }), 'Standard'));
      state.setTermsAccepted('2026-11-11T10:00:00Z');
      expect(await svc.confirm()).toBe(false);
      expect(state.offer()?.monthlyRepayment).toBe(40_000);
      expect(state.termsAcceptedAt()).toBeNull();
      expect(go).toHaveBeenCalledWith(APPLY.terms);
    });

    it('stops, without changing anything, when the server cannot be reached', async () => {
      const { svc, state, go } = setup(async () => ({ status: 'unavailable' }));
      state.setOffer(offerFromQuote(quote({ expiresAt: new Date(Date.now() - 1000).toISOString() }), 'Standard'));
      expect(await svc.confirm()).toBe(false);
      expect(state.offer()?.quote?.quoteId).toBeDefined();
      expect(go).not.toHaveBeenCalled();
    });

    it('does not go on with an offer that has no server quote', async () => {
      const { svc, state } = setup(async () => ({ status: 'unavailable' }));
      state.setOffer({ productId: 'ippis-standard' } as never);
      expect(await svc.confirm()).toBe(false);
    });
  });

  it('names terms so two different sets never share an answer', () => {
    expect(quoteKey(input(100_000))).not.toBe(quoteKey(input(100_000, 3)));
    expect(quoteKey({ ...input(100_000), referralCode: 'A' })).not.toBe(quoteKey(input(100_000)));
  });
});
