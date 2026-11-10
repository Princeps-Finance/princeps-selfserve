import { TestBed } from '@angular/core/testing';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { TermsComponent } from './terms.component';

describe('TermsComponent', () => {
  it('keeps the agreement locked until the offer letter has been read to the end', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: API_CLIENT, useValue: { getOfferLetter: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])) } },
        { provide: FlowNavigator, useValue: { go: vi.fn() } },
      ],
    });
    TestBed.inject(ApplicationStateService).setOffer({
      productId: 'ippis-advance', productName: 'IPPIS Salary Advance', amount: 300000, tenorMonths: 6, ratePercent: 5,
      interestModel: 'Flat Rate', monthlyRepayment: 57500, fees: [],
    });
    const c = TestBed.createComponent(TermsComponent).componentInstance;
    c.toggleAgree(true);
    expect(c.agreed()).toBe(false);
    c.letterRead.set(true);
    c.toggleAgree(true);
    expect(c.agreed()).toBe(true);
  });
});
