import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { EligibilityPreviewResponse } from '../data-access/parity-contract';
import { formatNaira } from '../money';
import { CheckFlowService } from './check-flow.service';
import { CheckResultComponent } from './check-result.component';

describe('CheckResultComponent', () => {
  function renderResult(result: EligibilityPreviewResponse) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(CheckFlowService).result.set(result);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(CheckResultComponent);
    fixture.detectChanges();
    return { screen: fixture.nativeElement as HTMLElement, navigate };
  }

  it('presents the anonymous result as indicative', () => {
    const { screen } = renderResult({
      decision: 'APPROVE',
      reasons: [],
      maximumAmount: 250_000,
      maximumTenor: 6,
      eligibleProducts: [],
    });

    expect(screen.textContent).toContain('Indicative eligibility result');
    expect(screen.querySelector('h1')?.textContent).toContain('You may be eligible for up to');
  });

  it('shows indicative limits and continues to verification when REFER has matching products', () => {
    const { screen, navigate } = renderResult({
      decision: 'REFER',
      reasons: [],
      maximumAmount: 250_000,
      maximumTenor: 6,
      eligibleProducts: [
        {
          productId: 'product-1',
          name: 'IPPIS Loan',
          category: 'state',
          minAmount: 50_000,
          maxAmount: 250_000,
          suggestedAmount: 250_000,
          defaultTenorMonths: 6,
          tenorOptions: [3, 6],
          calculation: {
            loanAmount: 250_000,
            duration: 6,
            rate: 4.5,
            interest: 67_500,
            fees: [],
            totalRepayment: 317_500,
            installmentRepayment: 52_916.67,
            schedule: [],
          },
        },
      ],
    });

    expect(screen.querySelector('h1')?.textContent).toContain(
      `Indicative loan limit of ${formatNaira(250_000)}`,
    );
    expect(screen.querySelector('.subtitle')?.textContent).toContain(
      'The indicative repayment period is up to 6 months.',
    );
    expect(screen.querySelector('#preview-products')?.textContent).toContain(
      'Indicative loan options',
    );
    expect(screen.querySelector('.product-list')?.textContent).toContain('IPPIS Loan');

    const verify = screen.querySelector<HTMLButtonElement>('.cta')!;
    expect(verify.textContent?.trim()).toBe('Continue to verify eligibility');
    verify.click();
    expect(navigate).toHaveBeenCalledWith('/apply/bvn');
  });

  it('shows a no-match state without a zero limit when REFER has no matching products', () => {
    const { screen } = renderResult({
      decision: 'REFER',
      reasons: [],
      maximumAmount: 0,
      maximumTenor: 0,
      eligibleProducts: [],
    });

    expect(screen.querySelector('h1')?.textContent).toContain('No matching loan products');
    expect(screen.textContent).not.toContain(formatNaira(0));
    expect(screen.textContent).not.toContain('0 months');
    expect(screen.querySelector('#preview-products')).toBeNull();
    expect(screen.querySelector('.cta')?.textContent?.trim()).toBe(
      'Continue to verify eligibility',
    );
  });
});
