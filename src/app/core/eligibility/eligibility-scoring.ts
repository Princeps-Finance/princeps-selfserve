/**
 * Rules-based (non-ML) loan eligibility scorer.
 *
 * Ported verbatim from Caltos (~/claude-lab/caltos/src/app/shared/utils/eligibility-scoring.ts).
 * Caltos is the single source of truth for this logic — do not diverge. If a rule
 * changes here, mirror it back to Caltos in the same PR (or vice-versa).
 *
 * Deltas from Caltos:
 * - `paramilitary` added to MdaCategory (federal-tier stability score in DEFAULT_ELIGIBILITY_CONFIG).
 * - `sme` and `private-large` remain in the type union, but the self-service flow
 *   currently routes these employment types to a "coming soon" waitlist upstream —
 *   the scorer itself does not know about that gate.
 */

import { estimateMonthlyRepayment } from '../../../shared/pricing';

export type IncomeSource = 'wacs' | 'remita' | 'deduct' | 'other';

export interface VerifiedIncomeInput {
  source: IncomeSource;
  /** Verified monthly income/salary from whichever source applies to this product. */
  monthlyAmount: number;
}

export interface NyscStabilityInput {
  type: 'nysc-corper';
  monthsRemaining: number;
}

export type MdaCategory =
  | 'federal'
  | 'state'
  | 'paramilitary'
  | 'private-large'
  | 'sme'
  | 'self-employed';

export interface MdaStabilityInput {
  type: 'mda';
  category: MdaCategory;
}

export type EmploymentStabilityInput = NyscStabilityInput | MdaStabilityInput;

export interface RepaymentHistoryInput {
  isRepeatBorrower: boolean;
  loansCompleted?: number;
  latePayments?: number;
  defaults?: number;
}

export interface InternalExposureInput {
  /** Does this BVN already have an active loan under a different product in our system? */
  hasActiveLoanElsewhere: boolean;
}

export interface EligibilityInput {
  income: VerifiedIncomeInput;
  stability: EmploymentStabilityInput;
  repaymentHistory: RepaymentHistoryInput;
  exposure: InternalExposureInput;
}

export interface EligibilityWeights {
  income: number;
  stability: number;
  repaymentHistory: number;
  exposure: number;
}

/** One explicit (monthsRemaining -> maxAmount) point on the NYSC table. */
export interface NyscAmountBand {
  monthsRemaining: number;
  maxAmount: number;
}

export interface AmountBand {
  /** Bands are evaluated highest-minScore-first; the first match wins. */
  minScore: number;
  /** Fraction of productMaxAmount unlocked at this score tier (0–1). */
  amountMultiplier: number;
}

export interface TenorBand {
  minScore: number;
  maxTenorMonths: number;
}

export interface EligibilityConfig {
  weights: EligibilityWeights;

  income: {
    /** Monthly income at or above which the income sub-score is a full 100. */
    targetMonthlyIncome: number;
    /** Monthly income below which the applicant is not considered at all (sub-score 0). */
    minMonthlyIncome: number;
  };

  stability: {
    /** 0–100 stability sub-score per MDA category. */
    mdaScores: Record<MdaCategory, number>;
    nysc: {
      amountTable: NyscAmountBand[];
      baseMonths: number;
      baseAmount: number;
      /** Amount removed per month below baseMonths when not covered by amountTable. */
      stepAmountPerMonth: number;
      /** Below this many months remaining, the corper is not eligible at all. */
      minEligibleMonthsRemaining: number;
    };
  };

  repaymentHistory: {
    /** Sub-score assigned to first-time borrowers — deliberately not 0 or 100. */
    newBorrowerScore: number;
    perCompletedLoanBonus: number;
    perLatePaymentPenalty: number;
    perDefaultPenalty: number;
  };

  exposure: {
    /** 'block' hard-declines on exposure; 'penalize' just tanks the sub-score. */
    mode: 'block' | 'penalize';
    /** Sub-score used when hasActiveLoanElsewhere is true and mode === 'penalize'. */
    penalizedScore: number;
  };

  /** Highest-minScore-first; first band whose minScore the overall score clears wins. */
  amountBands: AmountBand[];
  tenorBands: TenorBand[];

  /** Hard ceilings this product will never exceed, regardless of score. */
  productMaxAmount: number;
  productMaxTenorMonths: number;
  productMinTenorMonths: number;
}

export interface EligibilityBreakdown {
  incomeScore: number;
  stabilityScore: number;
  repaymentHistoryScore: number;
  exposureScore: number;
}

/** Machine-readable decline/caution reasons, translated in the UI. */
export interface ReasonCode {
  code: 'nysc_too_short' | 'exposure_blocked' | 'exposure_penalized' | 'score_too_low';
  params?: Record<string, number>;
}

export interface EligibilityResult {
  /** Normalized 0–100 overall score. */
  score: number;
  decision: 'approved' | 'declined';
  maxEligibleAmount: number;
  tenorMonths: number;
  breakdown: EligibilityBreakdown;
  reasons: string[];
  reasonCodes: ReasonCode[];
}

export const DEFAULT_ELIGIBILITY_CONFIG: EligibilityConfig = {
  weights: { income: 0.35, stability: 0.25, repaymentHistory: 0.25, exposure: 0.15 },

  income: {
    targetMonthlyIncome: 150_000,
    minMonthlyIncome: 30_000,
  },

  stability: {
    mdaScores: {
      federal: 100,
      state: 85,
      paramilitary: 100,
      'private-large': 70,
      sme: 50,
      'self-employed': 30,
    },
    nysc: {
      amountTable: [
        { monthsRemaining: 9, maxAmount: 300_000 },
        { monthsRemaining: 8, maxAmount: 260_000 },
      ],
      baseMonths: 9,
      baseAmount: 300_000,
      stepAmountPerMonth: 40_000,
      minEligibleMonthsRemaining: 3,
    },
  },

  repaymentHistory: {
    newBorrowerScore: 60,
    perCompletedLoanBonus: 8,
    perLatePaymentPenalty: 12,
    perDefaultPenalty: 40,
  },

  exposure: {
    mode: 'penalize',
    penalizedScore: 20,
  },

  amountBands: [
    { minScore: 85, amountMultiplier: 1 },
    { minScore: 70, amountMultiplier: 0.7 },
    { minScore: 50, amountMultiplier: 0.4 },
    { minScore: 0, amountMultiplier: 0 },
  ],

  tenorBands: [
    { minScore: 85, maxTenorMonths: 12 },
    { minScore: 70, maxTenorMonths: 9 },
    { minScore: 50, maxTenorMonths: 6 },
    { minScore: 0, maxTenorMonths: 0 },
  ],

  productMaxAmount: 300_000,
  productMaxTenorMonths: 12,
  productMinTenorMonths: 3,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Monthly repayment estimate supporting all three interest models:
 * - Flat Rate: total = principal * (1 + rate), split evenly
 * - Percentage Based: monthly interest = principal * rate, added to each instalment
 * - Reducing Balance: standard PMT formula (interest on outstanding balance each period)
 */
export { estimateMonthlyRepayment };

function pickBand<T extends { minScore: number }>(bands: T[], score: number): T {
  const match = bands.find((b) => score >= b.minScore);
  return match ?? bands[bands.length - 1];
}

function scoreIncome(input: VerifiedIncomeInput, config: EligibilityConfig): number {
  if (input.monthlyAmount < config.income.minMonthlyIncome) return 0;
  return clamp((input.monthlyAmount / config.income.targetMonthlyIncome) * 100, 0, 100);
}

function scoreStability(
  input: EmploymentStabilityInput,
  config: EligibilityConfig,
): {
  score: number;
  nyscCap: { amount: number; tenorMonths: number } | null;
  reasons: string[];
  codes: ReasonCode[];
} {
  const reasons: string[] = [];
  const codes: ReasonCode[] = [];

  if (input.type === 'mda') {
    return { score: config.stability.mdaScores[input.category], nyscCap: null, reasons, codes };
  }

  const { monthsRemaining } = input;
  const nyscConfig = config.stability.nysc;

  if (monthsRemaining < nyscConfig.minEligibleMonthsRemaining) {
    reasons.push(
      `Declined: NYSC service ends in ${monthsRemaining} month(s), below the ${nyscConfig.minEligibleMonthsRemaining}-month minimum.`,
    );
    codes.push({
      code: 'nysc_too_short',
      params: { months: monthsRemaining, min: nyscConfig.minEligibleMonthsRemaining },
    });
    return { score: 0, nyscCap: { amount: 0, tenorMonths: 0 }, reasons, codes };
  }

  const explicit = nyscConfig.amountTable.find((b) => b.monthsRemaining === monthsRemaining);
  const amount =
    explicit?.maxAmount ??
    clamp(
      nyscConfig.baseAmount -
        nyscConfig.stepAmountPerMonth * (nyscConfig.baseMonths - monthsRemaining),
      0,
      nyscConfig.baseAmount,
    );

  const score = clamp((monthsRemaining / nyscConfig.baseMonths) * 100, 0, 100);
  return { score, nyscCap: { amount, tenorMonths: monthsRemaining }, reasons, codes };
}

function scoreRepaymentHistory(
  input: RepaymentHistoryInput,
  config: EligibilityConfig,
): number {
  if (!input.isRepeatBorrower) return config.repaymentHistory.newBorrowerScore;

  const { perCompletedLoanBonus, perLatePaymentPenalty, perDefaultPenalty } =
    config.repaymentHistory;
  const score =
    config.repaymentHistory.newBorrowerScore +
    (input.loansCompleted ?? 0) * perCompletedLoanBonus -
    (input.latePayments ?? 0) * perLatePaymentPenalty -
    (input.defaults ?? 0) * perDefaultPenalty;

  return clamp(score, 0, 100);
}

function scoreExposure(
  input: InternalExposureInput,
  config: EligibilityConfig,
): { score: number; hardBlock: boolean; reasons: string[]; codes: ReasonCode[] } {
  if (!input.hasActiveLoanElsewhere) return { score: 100, hardBlock: false, reasons: [], codes: [] };

  if (config.exposure.mode === 'block') {
    return {
      score: 0,
      hardBlock: true,
      reasons: ['Declined: this BVN already has an active loan under a different product.'],
      codes: [{ code: 'exposure_blocked' }],
    };
  }

  return {
    score: config.exposure.penalizedScore,
    hardBlock: false,
    reasons: ['Existing active loan under a different product reduced the score.'],
    codes: [{ code: 'exposure_penalized' }],
  };
}

export function scoreEligibility(
  input: EligibilityInput,
  config: EligibilityConfig = DEFAULT_ELIGIBILITY_CONFIG,
): EligibilityResult {
  const reasons: string[] = [];

  const incomeScore = scoreIncome(input.income, config);
  const stability = scoreStability(input.stability, config);
  const repaymentHistoryScore = scoreRepaymentHistory(input.repaymentHistory, config);
  const exposure = scoreExposure(input.exposure, config);

  reasons.push(...stability.reasons, ...exposure.reasons);
  const reasonCodes: ReasonCode[] = [...stability.codes, ...exposure.codes];

  const breakdown: EligibilityBreakdown = {
    incomeScore,
    stabilityScore: stability.score,
    repaymentHistoryScore,
    exposureScore: exposure.score,
  };

  const { weights } = config;
  const totalWeight =
    weights.income + weights.stability + weights.repaymentHistory + weights.exposure || 1;
  const score = clamp(
    (incomeScore * weights.income +
      stability.score * weights.stability +
      repaymentHistoryScore * weights.repaymentHistory +
      exposure.score * weights.exposure) /
      totalWeight,
    0,
    100,
  );

  const isHardDeclined = exposure.hardBlock || stability.nyscCap?.amount === 0;

  const amountMultiplier = pickBand(config.amountBands, score).amountMultiplier;
  let maxEligibleAmount = Math.round(config.productMaxAmount * amountMultiplier);
  let tenorMonths = pickBand(config.tenorBands, score).maxTenorMonths;

  if (stability.nyscCap) {
    maxEligibleAmount = Math.min(maxEligibleAmount, stability.nyscCap.amount);
    tenorMonths = Math.min(tenorMonths, stability.nyscCap.tenorMonths);
  }

  tenorMonths = clamp(tenorMonths, 0, config.productMaxTenorMonths);
  if (tenorMonths > 0) tenorMonths = Math.max(tenorMonths, config.productMinTenorMonths);

  if (isHardDeclined || maxEligibleAmount <= 0 || tenorMonths <= 0) {
    return {
      score,
      decision: 'declined',
      maxEligibleAmount: 0,
      tenorMonths: 0,
      breakdown,
      reasons: reasons.length ? reasons : ['Declined: score too low for any eligible amount.'],
      reasonCodes: reasonCodes.length ? reasonCodes : [{ code: 'score_too_low' }],
    };
  }

  return {
    score: Math.round(score * 10) / 10,
    decision: 'approved',
    maxEligibleAmount,
    tenorMonths,
    breakdown,
    reasons,
    reasonCodes,
  };
}
