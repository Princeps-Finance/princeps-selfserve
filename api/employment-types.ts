// API handler (runs in the Cloudflare Worker): the employment types the Princeps self-service API can serve right now.
// A read-only pass-through, so the app can show only the choices that are really open. It sends nothing about
// the customer, and only the fields the app uses go back to the browser.
import { clientIp, fail, isSameOrigin, json, rateLimited } from './_lib/http';


export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return fail('METHOD_NOT_ALLOWED', 'GET only.', 405);
  if (!isSameOrigin(req) && req.headers.get('origin') !== null) return fail('FORBIDDEN', 'Request not allowed.', 403);
  if (await rateLimited(`employment-types:${clientIp(req)}`, 30)) return fail('RATE_LIMITED', 'Too many attempts.', 429);

  const base = process.env['SELF_SERVICE_API_URL']?.replace(/\/+$/, '');
  if (!base) return fail('CONFIG', 'Service unavailable.', 503);

  try {
    const res = await fetch(`${base}/api/employment-types`, { signal: AbortSignal.timeout(5_000) });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data)) return fail('UPSTREAM_DOWN', 'Service unavailable.', 502);
    const types = data
      .filter((row): row is { code: string; isAvailable: boolean } => !!row && typeof row.code === 'string' && typeof row.isAvailable === 'boolean')
      .map((row) => ({ code: row.code.slice(0, 40), isAvailable: row.isAvailable }));
    return json({ types });
  } catch {
    return fail('UPSTREAM_DOWN', 'Service unavailable.', 502);
  }
}
