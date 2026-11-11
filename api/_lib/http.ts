// Shared helpers for the API handlers: JSON responses, same-origin check,
// body-size limit, best-effort rate limiting and the backoffice fetch wrapper.

export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function fail(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') ?? 'unknown').trim();
}

/**
 * Browser calls must come from our own origin. This does not stop a scripted
 * client (headers can be forged); it blocks cross-site browser abuse. Real
 * abuse control is the rate limit below plus Vercel Firewall rules.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const allowed = (process.env['ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length) return allowed.includes(origin);
  const host = req.headers.get('host');
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Reads and parses a JSON body, refusing anything larger than maxBytes. */
export async function readJson(req: Request, maxBytes = 8 * 1024): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new HttpError('TOO_LARGE', 'Request too large.', 413);
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError('TOO_LARGE', 'Request too large.', 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError('BAD_JSON', 'Invalid JSON.', 400);
  }
}

export class HttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// ---- Rate limiting -------------------------------------------------------
// One shared counter store (Upstash Redis over REST) so limits hold across serverless instances.
// - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set: every limit is counted in Redis.
// - Not set, not production (local, preview, tests): an in-memory counter, per instance, for development only.
// - Not set, production: FAIL CLOSED. Every limited call is refused, so the app cannot go live without the store.
// Keys are hashed before they reach Redis, so no BVN, phone number or token is ever stored there.
const buckets = new Map<string, { count: number; resetAt: number }>();

function memoryLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > limit;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sharedLimited(url: string, token: string, key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const redisKey = `rl:${await sha256Hex(key)}`;
    const res = await fetch(`${url.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, String(windowMs), 'NX'],
      ]),
      signal: AbortSignal.timeout(2_000),
    });
    const data = (await res.json()) as Array<{ result?: unknown }>;
    const count = Number(data?.[0]?.result);
    if (!res.ok || !Number.isFinite(count)) throw new Error('bad response');
    return count > limit;
  } catch {
    // The store is down: refuse rather than let abuse through.
    console.error('rate limit store unreachable; refusing the call');
    return true;
  }
}

/** True when this key has used up its allowance for the window (so the caller should answer 429). */
export async function rateLimited(key: string, limit: number, windowMs = 60_000): Promise<boolean> {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (url && token) return sharedLimited(url, token, key, limit, windowMs);
  if (process.env['APP_ENV'] === 'production') {
    console.error('rate limit store not configured (UPSTASH_REDIS_REST_URL / _TOKEN); refusing the call');
    return true;
  }
  return memoryLimited(key, limit, windowMs);
}

// ---- Backoffice ----------------------------------------------------------
export interface BackofficeConfig {
  url: string;
  token: string;
}

/** Read per request so a rotated env var applies without a redeploy. */
export function backofficeConfig(): BackofficeConfig | null {
  const url = process.env['BACKOFFICE_API_URL']?.replace(/\/+$/, '');
  const token = process.env['SELFSERVE_INGEST_TOKEN'];
  return url && token ? { url, token } : null;
}

export async function callBackoffice(
  cfg: BackofficeConfig,
  path: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
  timeoutMs = 10_000,
): Promise<{ status: number; data: unknown } | null> {
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.token}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data: unknown = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch (err) {
    console.error('backoffice unreachable', path, err instanceof Error ? err.name : 'error');
    return null;
  }
}

// ---- Bot check (Cloudflare Turnstile) -----------------------------------
/**
 * When TURNSTILE_SECRET is set, requests that send an SMS must carry a valid
 * Turnstile token. With no secret configured the check is skipped, so local
 * development and the first deploy still work; set it before going live.
 */
export async function verifyCaptcha(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env['TURNSTILE_SECRET'];
  // No secret is acceptable only while developing; in production a missing secret must not switch the check off.
  if (!secret) return process.env['APP_ENV'] !== 'production';
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
