import {
  formatPhoneNgDisplay,
  isValidEmailShape,
  normalizePhoneNg,
  suggestEmailFix,
} from './contact.util';

describe('normalizePhoneNg', () => {
  it.each([
    ['08031112233', '+2348031112233'],
    ['+234 803 111 2233', '+2348031112233'],
    ['2348031112233', '+2348031112233'],
    ['8031112233', '+2348031112233'],
  ])('normalises %s', (input, expected) => {
    expect(normalizePhoneNg(input)).toBe(expected);
  });

  it.each(['', 'abc', '0803111223', '08031112233444', '06031112233'])('rejects %j', (input) => {
    expect(normalizePhoneNg(input)).toBeNull();
  });
});

describe('formatPhoneNgDisplay', () => {
  it('groups a canonical number and leaves anything else alone', () => {
    expect(formatPhoneNgDisplay('+2348031112233')).toBe('+234 803 111 2233');
    expect(formatPhoneNgDisplay('12345')).toBe('12345');
  });
});

describe('isValidEmailShape', () => {
  it('accepts normal addresses and rejects malformed ones', () => {
    expect(isValidEmailShape('ada@example.com')).toBe(true);
    expect(isValidEmailShape('ada@example')).toBe(false);
    expect(isValidEmailShape('ada example@x.com')).toBe(false);
  });
});

describe('suggestEmailFix', () => {
  it('suggests the likely domain for a near miss', () => {
    expect(suggestEmailFix('ada@gmial.com')).toBe('ada@gmail.com');
  });

  it('returns null for a correct or unrelated domain', () => {
    expect(suggestEmailFix('ada@gmail.com')).toBeNull();
    expect(suggestEmailFix('ada@acme-widgets.io')).toBeNull();
    expect(suggestEmailFix('not-an-email')).toBeNull();
  });
});

describe('suggestEmailFix (edit distance)', () => {
  it('handles transpositions, substitutions and missing letters', () => {
    expect(suggestEmailFix('a@gmial.com')).toBe('a@gmail.com');
    expect(suggestEmailFix('a@gmal.com')).toBe('a@gmail.com');
    expect(suggestEmailFix('a@yahooo.com')).toBe('a@yahoo.com');
  });
});

import { maskPhoneNg } from './contact.util';

describe('maskPhoneNg', () => {
  it('keeps only the last two digits', () => {
    expect(maskPhoneNg('08031112233')).toBe('+234 •••• ••33');
    expect(maskPhoneNg('+2348031112299')).toBe('+234 •••• ••99');
  });
  it('shows nothing for a number that is not valid', () => {
    expect(maskPhoneNg('12345')).toBe('');
  });
});
