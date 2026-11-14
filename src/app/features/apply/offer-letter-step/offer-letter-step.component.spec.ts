import { TestBed } from '@angular/core/testing';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { OfferLetterStepComponent } from './offer-letter-step.component';

describe('OfferLetterStepComponent', () => {
  function create() {
    const go = vi.fn();
    const next = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: API_CLIENT, useValue: { getOfferLetter: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])) } },
        { provide: FlowNavigator, useValue: { go, next } },
      ],
    });
    const state = TestBed.inject(ApplicationStateService);
    state.setOffer({ productId: 'ippis-advance', productName: 'IPPIS Salary Advance', amount: 300000, tenorMonths: 6, ratePercent: 5, interestModel: 'Flat Rate', monthlyRepayment: 57500, fees: [], quote: { quoteId: 'q1', expiresAt: new Date(Date.now() + 3_600_000).toISOString() } as never });
    return { go: next, state, c: TestBed.createComponent(OfferLetterStepComponent).componentInstance };
  }

  it('keeps the agreement locked until the letter has been read to the end', () => {
    const { c } = create();
    c.toggleAgree(true);
    expect(c.agreed()).toBe(false);
    c.letterRead.set(true);
    c.toggleAgree(true);
    expect(c.agreed()).toBe(true);
  });

  it('records the acceptance and goes on to the repayment set-up only once agreed', async () => {
    const { c, state, go } = create();
    await c.accept();
    expect(state.termsAcceptedAt()).toBeNull();
    expect(go).not.toHaveBeenCalled();
    c.letterRead.set(true);
    c.toggleAgree(true);
    await c.accept();
    expect(state.termsAcceptedAt()).not.toBeNull();
    expect(go).toHaveBeenCalledWith(APPLY.offerLetter);
  });
});
