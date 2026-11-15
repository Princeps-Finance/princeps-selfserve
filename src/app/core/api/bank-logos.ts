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

/** A logo address from the back end is only trusted when it is a path on our own site, which the page's security policy allows. */
function ownSitePath(v: unknown): string | undefined {
  return typeof v === 'string' && /^\/(?!\/)[\w./-]+$/.test(v) && !v.includes('..') ? v : undefined;
}

/** Keeps the banks the back end sent that have a code and a name, and a logo only when it is a safe path. */
export function sanitizeBanks(raw: readonly unknown[]): Bank[] {
  const out: Bank[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const code = typeof r['code'] === 'string' ? r['code'].trim() : '';
    const name = typeof r['name'] === 'string' ? r['name'].trim() : '';
    if (!code || !name || seen.has(code)) continue;
    seen.add(code);
    const logo = ownSitePath(r['logo']);
    out.push(logo ? { code, name, logo } : { code, name });
  }
  return out;
}

/** A bank as a choice in the select sheet. Its own logo wins, then one we ship, then its initials. */
export function bankOption(b: Bank): SelectOption {
  return { value: b.code, label: b.name, logo: ownSitePath(b.logo) ?? bankLogo(b.code), initials: bankInitials(b.name) };
}
