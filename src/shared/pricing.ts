/**
 * Loan pricing — the single source of truth for rates, limits, fees and the
 * repayment formula. Pure TypeScript with no Angular imports so the browser
 * (offers screen) and the Vercel submit function compute identical numbers.
 * The server recomputes from this catalogue and never trusts client figures.
 */

export type PricingEmployment =
  | 'government'
  | 'paramilitary'
  | 'corper'
  | 'private-sector'
  | 'own-business';
export type PricingChannel = 'remita' | 'ippis' | 'dedukt';
export type InterestModel = 'Flat Rate' | 'Reducing Balance' | 'Percentage Based';

export type MandateMode = 'authorize' | 'link';
export type IdentityVideoMode = 'none' | 'record' | 'upload' | 'either';

/** Per-product journey settings. In production these come from Caltos. */
export interface ProductSettings {
  /** 'authorize' = tick-box mandate; 'link' = a link the customer completes. */
  mandate: MandateMode;
  /** How the identity video is provided. */
  identityVideo: IdentityVideoMode;
  /** NIN is not required for every product. */
  requiresNin: boolean;
}

export interface PricingProduct {
  id: string;
  channel: PricingChannel;
  employmentTypes: PricingEmployment[];
  ratePercent: number;
  interestModel: InterestModel;
  minAmount: number;
  maxAmount: number;
  /** Smallest change the customer can make to the amount. */
  amountStep: number;
  minTenorMonths: number;
  maxTenorMonths: number;
  settings: ProductSettings;
  fees: { name: string; percent?: number; flat?: number }[];
}

export const MIN_TENOR_MONTHS = 3;
export const MAX_TENOR_MONTHS = 12;

export const PRICING_PRODUCTS: readonly PricingProduct[] = [
  {
    id: 'ippis-advance',
    channel: 'ippis',
    employmentTypes: ['government'],
    ratePercent: 4,
    interestModel: 'Reducing Balance',
    minAmount: 50_000,
    maxAmount: 300_000,
    amountStep: 5_000,
    minTenorMonths: 3,
    maxTenorMonths: 12,
    settings: { mandate: 'authorize', identityVideo: 'record', requiresNin: false },
    fees: [
      { name: 'Management fee', percent: 1 },
      { name: 'Insurance', percent: 0.5 },
    ],
  },
  {
    id: 'ippis-standard',
    channel: 'ippis',
    employmentTypes: ['government'],
    ratePercent: 5,
    interestModel: 'Flat Rate',
    minAmount: 100_000,
    maxAmount: 300_000,
    amountStep: 5_000,
    minTenorMonths: 3,
    maxTenorMonths: 12,
    settings: { mandate: 'link', identityVideo: 'either', requiresNin: false },
    fees: [{ name: 'Processing fee', percent: 2 }],
  },
  {
    id: 'dedukt-primary',
    channel: 'dedukt',
    employmentTypes: ['paramilitary'],
    ratePercent: 6,
    interestModel: 'Flat Rate',
    minAmount: 50_000,
    maxAmount: 300_000,
    amountStep: 5_000,
    minTenorMonths: 3,
    maxTenorMonths: 12,
    settings: { mandate: 'authorize', identityVideo: 'record', requiresNin: true },
    fees: [
      { name: 'Management fee', percent: 1 },
      { name: 'Insurance', flat: 2_000 },
    ],
  },
  {
    id: 'corper-allowee',
    channel: 'remita',
    employmentTypes: ['corper'],
    ratePercent: 5,
    interestModel: 'Flat Rate',
    minAmount: 30_000,
    maxAmount: 300_000,
    amountStep: 1_000,
    minTenorMonths: 3,
    maxTenorMonths: 11,
    settings: { mandate: 'link', identityVideo: 'record', requiresNin: true },
    fees: [{ name: 'Processing fee', flat: 1_500 }],
  },
];

export function pricingProductById(id: string): PricingProduct | undefined {
  return PRICING_PRODUCTS.find((p) => p.id === id);
}

export function estimateMonthlyRepayment(
  amount: number,
  tenorMonths: number,
  ratePercent: number,
  model: InterestModel = 'Flat Rate',
): number {
  // NaN, zero or negative money must fail loudly, not turn into a plausible-looking repayment.
  if (!(amount > 0) || !(ratePercent >= 0) || !Number.isFinite(tenorMonths)) throw new RangeError('Invalid loan terms');
  const n = Math.max(tenorMonths, 1);
  const r = ratePercent / 100;
  if (model === 'Reducing Balance') {
    if (r === 0) return Math.ceil(amount / n);
    const pmt = (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.ceil(pmt);
  }
  return Math.ceil((amount * (1 + r)) / n);
}

export function calcProductFees(
  product: Pick<PricingProduct, 'fees'>,
  amount: number,
): { name: string; amount: number }[] {
  return product.fees.map((f) => ({
    name: f.name,
    amount: Math.round(f.percent ? (amount * f.percent) / 100 : (f.flat ?? 0)),
  }));
}

export interface ScheduleLine {
  month: number;
  principal: number;
  interest: number;
  /** What the customer pays that month. Equal for every month, so the lines add up to the quote's total repayment. */
  payment: number;
  balance: number;
}

/**
 * The month-by-month repayment table, built from the same monthly figure as the quote so the two can never
 * disagree. Rounding differences are settled in the last month. "Percentage Based" is priced like "Flat Rate"
 * (see estimateMonthlyRepayment) until a product defines something different.
 */
export function buildRepaymentSchedule(
  principal: number,
  tenorMonths: number,
  ratePercent: number,
  model: InterestModel = 'Flat Rate',
): ScheduleLine[] {
  const n = Math.max(tenorMonths, 1);
  const monthly = estimateMonthlyRepayment(principal, n, ratePercent, model);
  const lines: ScheduleLine[] = [];
  let balance = principal;
  const monthlyRate = ratePercent / 100;
  const flatInterest = monthly * n - principal;
  for (let month = 1; month <= n; month++) {
    const last = month === n;
    let interest: number;
    let principalPaid: number;
    if (model === 'Reducing Balance') {
      interest = last ? monthly - balance : Math.round(balance * monthlyRate);
      principalPaid = last ? balance : monthly - interest;
    } else {
      principalPaid = last ? balance : Math.round(principal / n);
      interest = last ? monthly - principalPaid : Math.round(flatInterest / n);
    }
    balance = Math.max(0, balance - principalPaid);
    lines.push({ month, principal: principalPaid, interest, payment: monthly, balance });
  }
  return lines;
}

export interface LoanQuote {
  amount: number;
  tenorMonths: number;
  monthly: number;
  totalRepayment: number;
  fees: { name: string; amount: number }[];
  totalFees: number;
  /** Interest alone: total repayment minus the amount borrowed. Fees are listed separately. */
  interest: number;
}

export function quoteLoan(
  product: PricingProduct,
  amount: number,
  tenorMonths: number,
): LoanQuote {
  const monthly = estimateMonthlyRepayment(amount, tenorMonths, product.ratePercent, product.interestModel);
  const fees = calcProductFees(product, amount);
  const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);
  const totalRepayment = monthly * tenorMonths;
  return {
    amount,
    tenorMonths,
    monthly,
    totalRepayment,
    fees,
    totalFees,
    interest: totalRepayment - amount,
  };
}

/** Limits a customer may choose within, given what they were found eligible for. */
export function offerLimits(
  product: PricingProduct,
  eligible: { maxAmount: number; maxTenorMonths: number },
): { minAmount: number; maxAmount: number; minTenor: number; maxTenor: number } | null {
  const step = product.amountStep;
  const maxAmount = Math.floor(Math.min(eligible.maxAmount, product.maxAmount) / step) * step;
  const maxTenor = Math.min(eligible.maxTenorMonths, product.maxTenorMonths);
  if (maxAmount < product.minAmount || maxTenor < product.minTenorMonths) return null;
  return { minAmount: product.minAmount, maxAmount, minTenor: product.minTenorMonths, maxTenor };
}

/** Rounds to the product step and keeps the amount inside the allowed range. */
export function clampAmount(product: PricingProduct, amount: number, limits: { minAmount: number; maxAmount: number }): number {
  const step = product.amountStep;
  const rounded = Math.round(amount / step) * step;
  return Math.min(limits.maxAmount, Math.max(limits.minAmount, rounded));
}

/**
 * Estimated yearly rate (APR) from the cash flows: the customer receives the amount minus any fees, then pays
 * `monthly` each month. Found by bisection on the monthly rate and compounded to a year. It is an estimate for
 * comparison; the offer Princeps confirms before acceptance is the one that counts.
 */
export function estimateApr(amount: number, totalFees: number, monthly: number, tenorMonths: number): number {
  const received = amount - totalFees;
  if (!(received > 0) || !(monthly > 0) || tenorMonths < 1) return 0;
  const presentValue = (rate: number): number => {
    let pv = 0;
    for (let k = 1; k <= tenorMonths; k++) pv += monthly / Math.pow(1 + rate, k);
    return pv;
  };
  let low = 0;
  let high = 2; // 200% a month is far beyond any product
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (presentValue(mid) > received) low = mid;
    else high = mid;
  }
  return (Math.pow(1 + (low + high) / 2, 12) - 1) * 100;
}
