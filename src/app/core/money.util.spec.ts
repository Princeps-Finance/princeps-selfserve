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

describe('spokenNaira', () => {
  it('reads an amount exact to the kobo', async () => {
    const { spokenNaira } = await import('./money.util');
    expect(spokenNaira(57500)).toBe('57,500 naira');
    expect(spokenNaira(300000.5)).toBe('300,000 naira and 50 kobo');
    expect(spokenNaira(1234.07)).toBe('1,234 naira and 7 kobo');
  });
});
