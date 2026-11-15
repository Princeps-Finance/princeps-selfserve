// API handler (runs in the Cloudflare Worker): the employment types the Princeps self-service API (v2) can serve right now.
// A read-only pass-through, so the app can show only the choices that are really open. It sends nothing about
// the customer, and only the fields the app uses go back to the browser.
import { clientIp, fail, isSameOrigin, json, rateLimited } from './_lib/http';
import { toEmploymentTypes, v2Base, v2Get } from './_lib/v2';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return fail('METHOD_NOT_ALLOWED', 'GET only.', 405);
  if (!isSameOrigin(req) && req.headers.get('origin') !== null) return fail('FORBIDDEN', 'Request not allowed.', 403);
  if (await rateLimited(`employment-types:${clientIp(req)}`, 30)) return fail('RATE_LIMITED', 'Too many attempts.', 429);

  if (!v2Base()) return fail('CONFIG', 'Service unavailable.', 503);

  const types = toEmploymentTypes(await v2Get('/employment-types'));
  if (!types.length) return fail('UPSTREAM_DOWN', 'Service unavailable.', 502);
  return json({ types });
}
