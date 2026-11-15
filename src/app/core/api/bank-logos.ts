import type { SelectOption } from '../ui/select-field.component';
import type { Bank } from './api.types';

/**
 * Logos kept in public/banks, named by the bank's CBN code. Access, GTBank and FirstBank use their group's mark.
 * A bank with no file here gets an initials badge instead, so every bank in the list, including ones the live list adds,
 * still has a mark.
 */
const LOGO_CODES: ReadonlySet<string> = new Set([
  '011', '033', '035', '044', '050', '057', '058', '070', '214', '215', '221', '232', '301',
]);

/** Diamond Bank is part of Access Bank and shares its mark. */
const SHARES_LOGO: Readonly<Record<string, string>> = { '063': '044' };

export function bankLogo(code: string): string | undefined {
  const file = SHARES_LOGO[code] ?? code;
  return LOGO_CODES.has(file) ? `/banks/${file}.svg` : undefined;
}

/** Up to two capital letters from the name, ignoring words like "Bank" and "of". */
export function bankInitials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter((w) => w && !/^(bank|banks|plc|ltd|of|the|for|and|microfinance|mfb|nigeria)$/i.test(w));
  const letters = (words.length ? words : [name]).map((w) => w[0]).join('').toUpperCase();
  return letters.slice(0, 2) || '?';
}

/** A bank as a choice in the select sheet, with its logo or initials. */
export function bankOption(b: Bank): SelectOption {
  return { value: b.code, label: b.name, logo: bankLogo(b.code), initials: bankInitials(b.name) };
}
