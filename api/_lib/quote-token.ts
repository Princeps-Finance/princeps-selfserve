// A quote id the server can recognise later without storing anything: the figures it stands for, a time it stops
// being valid, and a signature only this server can make. The submit handler checks it, so a customer cannot
// send figures the server never offered.

const enc = new TextEncoder();

export interface QuoteClaims {
  p: string; // product id
  a: number; // amount in kobo
  t: number; // tenor in months
  m: number; // monthly repayment in kobo
  r: number; // rate percent
  x: number; // expires at (ms since 1970)
}

function secret(): string | null {
  const s = process.env['QUOTE_SECRET'];
  if (s && s.length >= 16) return s;
  // Only a development deployment may run without its own secret: the key is then public, so nothing is protected.
  return process.env['APP_ENV'] === 'production' ? null : 'development-only-quote-secret';
}

const b64 = (bytes: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

type Key = Awaited<ReturnType<typeof crypto.subtle.importKey>>;

async function key(): Promise<Key | null> {
  const s = secret();
  return s ? crypto.subtle.importKey('raw', enc.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']) : null;
}

export async function signQuote(claims: QuoteClaims): Promise<string | null> {
  const k = await key();
  if (!k) return null;
  const body = b64(enc.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(body));
  return `${body}.${b64(sig)}`;
}

/** The claims inside a quote id, or null when it is forged, damaged or unreadable. Expiry is checked by the caller. */
export async function verifyQuote(token: string): Promise<QuoteClaims | null> {
  const k = await key();
  const [body, sig] = token.split('.');
  if (!k || !body || !sig || token.length > 600) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', k, unb64(sig), enc.encode(body));
    if (!ok) return null;
    const c = JSON.parse(new TextDecoder().decode(unb64(body))) as QuoteClaims;
    return typeof c.p === 'string' && [c.a, c.t, c.m, c.r, c.x].every(Number.isFinite) ? c : null;
  } catch {
    return null;
  }
}
