import {
  buildRepaymentSchedule,
  estimateApr,
  PRICING_PRODUCTS,
  clampAmount,
  offerLimits,
  quoteLoan,
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

describe('estimateApr', () => {
  it('is zero for nonsense input and rises with fees', () => {
    expect(estimateApr(0, 0, 100, 6)).toBe(0);
    const noFees = estimateApr(200_000, 0, 35_000, 6);
    const withFees = estimateApr(200_000, 4_000, 35_000, 6);
    expect(noFees).toBeGreaterThan(0);
    expect(withFees).toBeGreaterThan(noFees);
  });

  it('matches a loan repaid with no interest at 0%', () => {
    expect(estimateApr(120_000, 0, 10_000, 12)).toBeCloseTo(0, 1);
  });
});

describe('quoteLoan', () => {
  it('adds up repayment, interest and fees', () => {
    const p = pricingProductById('ippis-standard')!; // 5% flat, 2% processing fee
    const q = quoteLoan(p, 200_000, 6);
    expect(q.monthly).toBe(35_000);
    expect(q.totalRepayment).toBe(210_000);
    expect(q.totalFees).toBe(4_000);
    expect(q.interest).toBe(10_000);
    expect(q.fees).toEqual([{ name: 'Processing fee', amount: 4_000 }]);
  });

  it('a longer tenor lowers the monthly payment', () => {
    const p = pricingProductById('ippis-advance')!;
    expect(quoteLoan(p, 100_000, 12).monthly).toBeLessThan(quoteLoan(p, 100_000, 6).monthly);
  });
});

describe('offerLimits and clampAmount', () => {
  const p = pricingProductById('ippis-advance')!; // 50k–300k, step 5k, 3–12 months

  it('caps the range by what the customer is eligible for, on a step boundary', () => {
    const l = offerLimits(p, { maxAmount: 123_456, maxTenorMonths: 9 })!;
    expect(l).toEqual({ minAmount: 50_000, maxAmount: 120_000, minTenor: 3, maxTenor: 9 });
  });

  it('never exceeds the product maximum', () => {
    expect(offerLimits(p, { maxAmount: 9_000_000, maxTenorMonths: 99 })).toMatchObject({ maxAmount: 300_000, maxTenor: 12 });
  });

  it('returns null when nothing fits (eligible amount or tenor below the product minimum)', () => {
    expect(offerLimits(p, { maxAmount: 20_000, maxTenorMonths: 12 })).toBeNull();
    expect(offerLimits(p, { maxAmount: 300_000, maxTenorMonths: 2 })).toBeNull();
  });

  it('rounds typed amounts to the step and keeps them in range', () => {
    const l = { minAmount: 50_000, maxAmount: 120_000 };
    expect(clampAmount(p, 87_300, l)).toBe(85_000);
    expect(clampAmount(p, 10, l)).toBe(50_000);
    expect(clampAmount(p, 999_999, l)).toBe(120_000);
  });
});

describe('product settings', () => {
  it('every product defines a mandate mode, identity video mode and NIN requirement', () => {
    for (const p of PRICING_PRODUCTS) {
      expect(['authorize', 'link']).toContain(p.settings.mandate);
      expect(['none', 'record', 'upload', 'either']).toContain(p.settings.identityVideo);
      expect(typeof p.settings.requiresNin).toBe('boolean');
      expect(p.minTenorMonths).toBeLessThanOrEqual(p.maxTenorMonths);
      expect(p.maxAmount % p.amountStep).toBe(0);
    }
  });
});

describe('buildRepaymentSchedule', () => {
  const cases: [number, number, number, 'Flat Rate' | 'Reducing Balance'][] = [
    [100_000, 3, 5, 'Flat Rate'],
    [250_000, 7, 4.5, 'Reducing Balance'],
    [50_000, 12, 0, 'Reducing Balance'],
    [333_335, 11, 5, 'Flat Rate'],
  ];
  it.each(cases)('adds up to the quote and clears the balance (%d over %d months at %d%% %s)', (amount, n, rate, model) => {
    const lines = buildRepaymentSchedule(amount, n, rate, model);
    const monthly = estimateMonthlyRepayment(amount, n, rate, model);
    expect(lines).toHaveLength(n);
    expect(lines.every((l) => l.payment === monthly)).toBe(true);
    expect(lines.reduce((sum, l) => sum + l.principal, 0)).toBe(amount);
    expect(lines.reduce((sum, l) => sum + l.payment, 0)).toBe(monthly * n);
    expect(lines.at(-1)!.balance).toBe(0);
  });
});
