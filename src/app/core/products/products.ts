import { EmploymentType, SalaryChannel } from '../application/application-state.service';
import { PRICING_PRODUCTS, calcProductFees } from '../../../shared/pricing';

export type RepaymentFrequency = 'monthly' | 'weekly' | 'bullet';

export interface ProductHero {
  from: string;
  to: string;
  glyph: string;
}

export interface Product {
  id: string;
  name: string;
  channel: SalaryChannel;
  employmentTypes: EmploymentType[];
  ratePercent: number;
  interestModel: 'Flat Rate' | 'Reducing Balance' | 'Percentage Based';
  repaymentFrequency: RepaymentFrequency;
  minAmount: number;
  maxAmount: number;
  fees: { name: string; percent?: number; flat?: number }[];
  hero: ProductHero;
}

const GLYPH_WALLET =
  'M4 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11';
const GLYPH_SHIELD =
  'M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z';
const GLYPH_BADGE =
  'M12 2l3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4l3-3z';
const GLYPH_SPARK =
  'M12 3v6M12 15v6M3 12h6M15 12h6M6 6l4 4M14 14l4 4M18 6l-4 4M10 14l-4 4';

const UI_META: Record<string, { name: string; hero: ProductHero }> = {
  'ippis-advance': { name: 'IPPIS Salary Advance', hero: { from: '#0B2E5B', to: '#3AB0C9', glyph: GLYPH_WALLET } },
  'ippis-standard': { name: 'IPPIS Standard Loan', hero: { from: '#0B2E5B', to: '#F6A45B', glyph: GLYPH_BADGE } },
  'dedukt-primary': { name: 'Paramilitary Dedukt Loan', hero: { from: '#0B2E5B', to: '#5A6F8C', glyph: GLYPH_SHIELD } },
  'corper-allowee': { name: 'NYSC Allowee Loan', hero: { from: '#F6A45B', to: '#3AB0C9', glyph: GLYPH_SPARK } },
};

/** Rates, limits and fees come from the shared catalogue; this adds display-only fields. */
export const PRODUCTS: Product[] = PRICING_PRODUCTS.map((p) => ({
  ...p,
  ...UI_META[p.id],
  repaymentFrequency: 'monthly' as RepaymentFrequency,
}));

export function productsFor(
  employment: EmploymentType,
  channel: SalaryChannel,
): Product[] {
  return PRODUCTS.filter(
    (p) => p.channel === channel && p.employmentTypes.includes(employment),
  );
}

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function calcFees(product: Product, amount: number): { name: string; amount: number }[] {
  return calcProductFees(product, amount);
}
