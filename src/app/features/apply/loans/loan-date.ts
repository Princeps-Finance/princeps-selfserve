const loanDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function formatLoanDate(value: string | null): string {
  return value ? loanDateFormatter.format(new Date(value)) : '—';
}
