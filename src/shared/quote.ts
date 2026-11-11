// A priced loan: every figure the customer sees, reads aloud, signs and is deducted. Built by the server (api/quote.ts)
// and, for the demo build, by the mock client. Framework-free, so both can use it. The browser never invents these
// figures for an application: it shows the ones the server returned and sends back the quote's id.

import { buildRepaymentSchedule, calcProductFees, estimateMonthlyRepayment, type PricingProduct } from './pricing';
import { firstPaydayAfter, dueDateOf } from './payday';

export interface QuoteLine {
  month: number;
  /** The day it is due, "YYYY-MM-DD". */
  dueDate: string;
  payment: number;
  balance: number;
}

export interface Quote {
  /** Names this exact quote. Later steps and the final send refer to it, never to figures. */
  quoteId: string;
  /** When the figures stop being valid (ISO time). */
  expiresAt: string;
  productId: string;
  amount: number;
  tenorMonths: number;
  ratePercent: number;
  interestModel: 'Flat Rate' | 'Reducing Balance' | 'Percentage Based';
  monthlyRepayment: number;
  fees: { name: string; amount: number }[];
  totalFees: number;
  totalInterest: number;
  totalRepayable: number;
  firstDueDate: string;
  schedule: QuoteLine[];
}

const isoDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** How long a quote stays valid. */
export const QUOTE_TTL_MS = 60 * 60 * 1000;

/** Prices a loan. `ratePercent` is already after any referral discount. The caller supplies the id. */
export function buildQuote(
  product: PricingProduct,
  amount: number,
  tenorMonths: number,
  ratePercent: number,
  quoteId: string,
  now: Date = new Date(),
): Quote {
  const monthly = estimateMonthlyRepayment(amount, tenorMonths, ratePercent, product.interestModel);
  const fees = calcProductFees(product, amount);
  const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);
  const totalRepayable = monthly * tenorMonths;
  const first = firstPaydayAfter(now);
  const schedule: QuoteLine[] = buildRepaymentSchedule(amount, tenorMonths, ratePercent, product.interestModel).map((line) => ({
    month: line.month,
    dueDate: isoDay(dueDateOf(first, line.month)),
    payment: line.payment,
    balance: line.balance,
  }));
  return {
    quoteId,
    expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
    productId: product.id,
    amount,
    tenorMonths,
    ratePercent,
    interestModel: product.interestModel,
    monthlyRepayment: monthly,
    fees,
    totalFees,
    totalInterest: totalRepayable - amount,
    totalRepayable,
    firstDueDate: isoDay(first),
    schedule,
  };
}

/** A due date from a quote as a local Date (the quote carries plain days, so no time-zone shift). */
export function dayToDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}
