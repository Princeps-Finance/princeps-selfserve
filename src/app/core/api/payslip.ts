/** The figures read off a payslip. The customer checks and can correct them before they are used. */
export interface PayslipFigures {
  /** Take-home pay for one month, in naira. */
  netMonthly: number;
  grossMonthly?: number;
  /** The pay month as YYYY-MM, when it could be read. */
  month?: string;
  employer?: string;
}

export type PayslipResult =
  | { status: 'ok'; figures: PayslipFigures }
  | { status: 'unreadable' | 'too-large' | 'bad-type' | 'rate-limited' | 'service-down' };

/** No salary a payslip shows is above this, so a bigger number is a misread, not a payslip. */
const MAX_MONTHLY_NAIRA = 100_000_000;

function naira(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(/[₦,\s]/g, '')) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= MAX_MONTHLY_NAIRA ? Math.round(n) : null;
}

/** Turns what the reader sent into safe figures. Null when there is no usable take-home pay. */
export function sanitizePayslipFigures(raw: unknown): PayslipFigures | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const netMonthly = naira(r['netMonthly']);
  if (netMonthly === null) return null;
  const gross = naira(r['grossMonthly']);
  const month = typeof r['month'] === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(r['month']) ? r['month'] : undefined;
  const employer = typeof r['employer'] === 'string' && r['employer'].trim() ? r['employer'].trim().slice(0, 80) : undefined;
  // Gross pay is never below take-home pay: if it reads that way, one of the two was misread, so only the net is kept.
  return { netMonthly, ...(gross !== null && gross >= netMonthly ? { grossMonthly: gross } : {}), ...(month ? { month } : {}), ...(employer ? { employer } : {}) };
}
