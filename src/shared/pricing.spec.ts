import {
  PRICING_PRODUCTS,
  calcProductFees,
  estimateMonthlyRepayment,
  pricingProductById,
} from './pricing';

describe('estimateMonthlyRepayment', () => {
  it('flat rate: principal plus one interest charge, split evenly, rounded up', () => {
    expect(estimateMonthlyRepayment(100_000, 6, 5, 'Flat Rate')).toBe(17_500);
    expect(estimateMonthlyRepayment(100_000, 7, 5, 'Flat Rate')).toBe(15_000);
  });

  it('reducing balance uses the annuity formula', () => {
    // 100,000 over 12 months at 4%/month => 10,655.22 -> rounded up.
    expect(estimateMonthlyRepayment(100_000, 12, 4, 'Reducing Balance')).toBe(10_656);
  });

  it('reducing balance at 0% is straight-line', () => {
    expect(estimateMonthlyRepayment(90_000, 6, 0, 'Reducing Balance')).toBe(15_000);
  });

  it('treats a tenor below 1 as 1 month instead of dividing by zero', () => {
    expect(estimateMonthlyRepayment(10_000, 0, 5, 'Flat Rate')).toBe(10_500);
  });

  it('never returns less than the principal over the tenor', () => {
    for (const p of PRICING_PRODUCTS) {
      const monthly = estimateMonthlyRepayment(p.minAmount, 6, p.ratePercent, p.interestModel);
      expect(monthly * 6).toBeGreaterThanOrEqual(p.minAmount);
    }
  });
});

describe('calcProductFees', () => {
  it('applies percentage and flat fees', () => {
    const ippis = pricingProductById('ippis-advance')!;
    expect(calcProductFees(ippis, 200_000)).toEqual([
      { name: 'Management fee', amount: 2_000 },
      { name: 'Insurance', amount: 1_000 },
    ]);
    const dedukt = pricingProductById('dedukt-primary')!;
    expect(calcProductFees(dedukt, 100_000).map((f) => f.amount)).toEqual([1_000, 2_000]);
  });
});

describe('pricing catalogue', () => {
  it('has unique ids and sane limits', () => {
    const ids = PRICING_PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PRICING_PRODUCTS) {
      expect(p.minAmount).toBeGreaterThan(0);
      expect(p.maxAmount).toBeGreaterThanOrEqual(p.minAmount);
      expect(p.ratePercent).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns undefined for an unknown product', () => {
    expect(pricingProductById('nope')).toBeUndefined();
  });
});
