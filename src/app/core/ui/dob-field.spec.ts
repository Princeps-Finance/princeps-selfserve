import { describe, expect, it } from 'vitest';
import { toIsoDate } from './dob-field.component';

describe('toIsoDate', () => {
  it('builds an ISO date from day, month and year', () => {
    expect(toIsoDate('4', '2', '1988')).toBe('1988-02-04');
    expect(toIsoDate('12', '12', '2001')).toBe('2001-12-12');
  });
  it('rejects dates that do not exist', () => {
    expect(toIsoDate('31', '4', '1988')).toBe('');
    expect(toIsoDate('29', '2', '1999')).toBe('');
    expect(toIsoDate('29', '2', '2000')).toBe('2000-02-29');
  });
  it('rejects incomplete, implausible or future dates', () => {
    expect(toIsoDate('', '2', '1988')).toBe('');
    expect(toIsoDate('4', '', '1988')).toBe('');
    expect(toIsoDate('4', '2', '88')).toBe('');
    expect(toIsoDate('4', '2', '1850')).toBe('');
    expect(toIsoDate('4', '2', String(new Date().getFullYear() + 1))).toBe('');
  });
});
