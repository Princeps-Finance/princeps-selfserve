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

export interface PricingProduct {
  id: string;
  channel: PricingChannel;
  employmentTypes: PricingEmployment[];
  ratePercent: number;
  interestModel: InterestModel;
  minAmount: number;
  maxAmount: number;
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
