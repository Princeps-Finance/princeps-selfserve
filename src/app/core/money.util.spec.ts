import { formatNaira } from './money.util';

describe('formatNaira', () => {
  it('formats whole naira with the currency symbol and grouping', () => {
    const out = formatNaira(180_000);
    expect(out).toContain('180,000');
    expect(out).toMatch(/₦|NGN/);
  });

  it('drops fractional kobo', () => {
    expect(formatNaira(1_234.56)).toContain('1,235');
  });
});
