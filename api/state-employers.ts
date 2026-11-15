// API handler: the state governments the Princeps self-service API (v2, `GET /mdas`) lets a customer pick. A read-only
// pass-through, so the state screen follows the live list without a release. It sends nothing about the customer.
import { clientIp, fail, isSameOrigin, json, rateLimited } from './_lib/http';
import { toStateGovernments, v2Base, v2Get } from './_lib/v2';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return fail('METHOD_NOT_ALLOWED', 'GET only.', 405);
  if (!isSameOrigin(req) && req.headers.get('origin') !== null) return fail('FORBIDDEN', 'Request not allowed.', 403);
  if (await rateLimited(`state-employers:${clientIp(req)}`, 30)) return fail('RATE_LIMITED', 'Too many attempts.', 429);
  if (!v2Base()) return fail('CONFIG', 'Service unavailable.', 503);

  const states = toStateGovernments(await v2Get('/mdas'));
  if (!states.length) return fail('UPSTREAM_DOWN', 'Service unavailable.', 502);
  return json({ states });
}
