import { formatLoanDate } from './loan-date';

describe('formatLoanDate', () => {
  it('shows a neutral fallback for a missing backend date', () => {
    expect(formatLoanDate(null)).toBe('—');
  });

  it('formats a date returned by the backend', () => {
    expect(formatLoanDate('2026-03-12')).not.toBe('—');
  });
});
