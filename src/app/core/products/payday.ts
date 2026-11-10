/** Salaries are paid on the 25th, so repayments are due then. */
export const PAYDAY_DAY = 25;

/** The first repayment date for a loan taken on `from`: this month's 25th up to the 15th, otherwise next month's. */
export function firstPaydayAfter(from: Date): Date {
  const monthOffset = from.getDate() <= 15 ? 0 : 1;
  return new Date(from.getFullYear(), from.getMonth() + monthOffset, PAYDAY_DAY);
}

/** The due date of repayment number `month` (1 is the first). */
export function dueDateOf(first: Date, month: number): Date {
  return new Date(first.getFullYear(), first.getMonth() + (month - 1), PAYDAY_DAY);
}
