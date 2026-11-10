/**
 * Normalize a Nigerian phone number to canonical +2348XXXXXXXXX.
 * Accepts: 080..., 0080..., +2348..., 2348..., 8... (10-digit local).
 * Returns null when the input can't be normalized to a valid MSISDN.
 */
export function normalizePhoneNg(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  let local: string;
  if (digits.startsWith('234')) local = digits.slice(3);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;

  if (local.length !== 10) return null;
  if (!/^[7-9]/.test(local)) return null;
  return `+234${local}`;
}

export function formatPhoneNgDisplay(canonical: string): string {
  const m = canonical.match(/^\+234(\d{3})(\d{3})(\d{4})$/);
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : canonical;
}

const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'live.com',
];

/** Levenshtein edit distance (insert, delete, substitute). */
function distance(a: string, b: string): number {
  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prevRow[j] + 1,
        row[j - 1] + 1,
        prevRow[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prevRow = row;
  }
  return prevRow[b.length];
}

export function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (COMMON_EMAIL_DOMAINS.includes(domain)) return null;

  let best: { d: string; score: number } | null = null;
  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const score = distance(domain, candidate);
    if (!best || score < best.score) best = { d: candidate, score };
  }
  if (best && best.score > 0 && best.score <= 2) return `${local}@${best.d}`;
  return null;
}

export function isValidEmailShape(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Shows only the last two digits of a Nigerian number, for places where the full number must not appear. */
export function maskPhoneNg(raw: string): string {
  const canonical = normalizePhoneNg(raw);
  return canonical ? `+234 •••• ••${canonical.slice(-2)}` : '';
}
