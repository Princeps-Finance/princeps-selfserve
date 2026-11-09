import {
  DEFAULT_ELIGIBILITY_CONFIG,
  EligibilityInput,
  scoreEligibility,
} from './eligibility-scoring';

const strong: EligibilityInput = {
  income: { source: 'remita', monthlyAmount: 1_000_000 },
  stability: { type: 'mda', category: 'federal' },
  repaymentHistory: { isRepeatBorrower: true, loansCompleted: 5, latePayments: 0, defaults: 0 },
  exposure: { hasActiveLoanElsewhere: false },
};

describe('scoreEligibility', () => {
  it('approves a strong, clean applicant within product ceilings', () => {
    const r = scoreEligibility(strong);
    expect(r.decision).toBe('approved');
    expect(r.maxEligibleAmount).toBeGreaterThan(0);
    expect(r.maxEligibleAmount).toBeLessThanOrEqual(DEFAULT_ELIGIBILITY_CONFIG.productMaxAmount);
    expect(r.tenorMonths).toBeGreaterThanOrEqual(DEFAULT_ELIGIBILITY_CONFIG.productMinTenorMonths);
    expect(r.tenorMonths).toBeLessThanOrEqual(DEFAULT_ELIGIBILITY_CONFIG.productMaxTenorMonths);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('declines when income is below the minimum and history is poor', () => {
    const r = scoreEligibility({
      ...strong,
      income: { source: 'remita', monthlyAmount: 1_000 },
      repaymentHistory: { isRepeatBorrower: true, loansCompleted: 0, latePayments: 5, defaults: 2 },
    });
    expect(r.decision).toBe('declined');
    expect(r.maxEligibleAmount).toBe(0);
    expect(r.tenorMonths).toBe(0);
  });

  it('declines a corper with too few months of service left', () => {
    const r = scoreEligibility({
      ...strong,
      stability: { type: 'nysc-corper', monthsRemaining: 0 },
    });
    expect(r.decision).toBe('declined');
  });

  it('caps a corper at the NYSC amount table', () => {
    const cap = DEFAULT_ELIGIBILITY_CONFIG.stability.nysc.amountTable.find(
      (b) => b.monthsRemaining === 8,
    );
    const r = scoreEligibility({
      ...strong,
      stability: { type: 'nysc-corper', monthsRemaining: 8 },
    });
    if (cap) expect(r.maxEligibleAmount).toBeLessThanOrEqual(cap.maxAmount);
    expect(r.maxEligibleAmount).toBeLessThanOrEqual(DEFAULT_ELIGIBILITY_CONFIG.productMaxAmount);
  });

  it('an existing loan elsewhere never improves the outcome', () => {
    const clean = scoreEligibility(strong);
    const exposed = scoreEligibility({ ...strong, exposure: { hasActiveLoanElsewhere: true } });
    expect(exposed.score).toBeLessThanOrEqual(clean.score);
    expect(exposed.maxEligibleAmount).toBeLessThanOrEqual(clean.maxEligibleAmount);
  });

  it('is deterministic', () => {
    expect(scoreEligibility(strong)).toEqual(scoreEligibility(strong));
  });

  it('explains a decline with machine-readable reasons that the UI can translate', () => {
    const corper = scoreEligibility({ ...strong, stability: { type: 'nysc-corper', monthsRemaining: 1 } });
    expect(corper.reasonCodes).toEqual([{ code: 'nysc_too_short', params: { months: 1, min: 3 } }]);

    const exposed = scoreEligibility({ ...strong, exposure: { hasActiveLoanElsewhere: true } });
    expect(exposed.reasonCodes.length).toBeGreaterThan(0);

    const poor = scoreEligibility({
      ...strong,
      income: { source: 'remita', monthlyAmount: 1_000 },
      repaymentHistory: { isRepeatBorrower: true, loansCompleted: 0, latePayments: 5, defaults: 2 },
    });
    expect(poor.decision).toBe('declined');
    expect(poor.reasonCodes.map((r) => r.code)).toContain('score_too_low');
  });
});
