/** Salaries are paid on the 25th, so repayments are due then (earlier when the 25th is a weekend or a public holiday). */
export const PAYDAY_DAY = 25;

/** The first repayment date for a loan taken on `from`: this month's 25th up to the 15th, otherwise next month's. */
export function firstPaydayAfter(from: Date): Date {
  // The calendar day in Nigeria, whatever time zone the phone is set to: a phone abroad must not move the payday.
  const { year, month, day } = lagosDate(from);
  const monthOffset = day <= 15 ? 0 : 1;
  return paydayOf(year, month + monthOffset);
}

function lagosDate(d: Date): { year: number; month: number; day: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const [year, month, day] = [get('year'), get('month') - 1, get('day')];
    if ([year, month, day].every(Number.isFinite)) return { year, month, day };
  } catch {
    /* no Intl time zones: use the phone's own date */
  }
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

/**
 * Public holidays that fall on a fixed date, as [month 1-12, day]. Easter-based holidays are worked out below.
 * Holidays that follow the moon (Eid and the Prophet's birthday) change every year: add their dates for the year
 * to EXTRA_HOLIDAYS as "YYYY-MM-DD" when the government announces them.
 */
const FIXED_HOLIDAYS: readonly (readonly [number, number])[] = [[1, 1], [5, 1], [6, 12], [10, 1], [12, 25], [12, 26]];
export const EXTRA_HOLIDAYS: string[] = [];

/** Easter Sunday for a year (the usual Gregorian calculation). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function isPublicHoliday(d: Date): boolean {
  if (FIXED_HOLIDAYS.some(([m, day]) => d.getMonth() + 1 === m && d.getDate() === day)) return true;
  const easter = easterSunday(d.getFullYear());
  const goodFriday = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2);
  const easterMonday = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 1);
  return iso(d) === iso(goodFriday) || iso(d) === iso(easterMonday) || EXTRA_HOLIDAYS.includes(iso(d));
}

export function isWorkingDay(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6 && !isPublicHoliday(d);
}

/** The pay date for a month: the 25th, or the working day before it when the 25th is a weekend or a public holiday. */
export function paydayOf(year: number, month: number): Date {
  const d = new Date(year, month, PAYDAY_DAY);
  while (!isWorkingDay(d)) d.setDate(d.getDate() - 1);
  return d;
}

/** The due date of repayment number `month` (1 is the first). */
export function dueDateOf(first: Date, month: number): Date {
  return paydayOf(first.getFullYear(), first.getMonth() + (month - 1));
}
