// API handler (runs in the Cloudflare Worker): checks a referral code the customer typed and answers with the discount, so the codes
// never ship in the browser bundle. The discount is granted again, from the same table, in /api/submit-loan.
import { z } from 'zod';
import { HttpError, clientIp, fail, isSameOrigin, json, rateLimited, readJson } from './_lib/http';
import { findReferral } from './_lib/referral-codes';


const Body = z.object({ code: z.string().trim().regex(/^[A-Za-z0-9]{3,20}$/) }).strict();

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'POST only.', 405);
  if (!isSameOrigin(req)) return fail('FORBIDDEN', 'Request not allowed.', 403);

  // Tight limit: guessing codes one by one must be slow and noisy.
  if (await rateLimited(`referral:${clientIp(req)}`, 8, 10 * 60_000)) {
    return fail('RATE_LIMITED', 'Too many attempts. Try again later.', 429);
  }

  let raw: unknown;
  try {
    raw = await readJson(req, 1024);
  } catch (err) {
    if (err instanceof HttpError) return fail(err.code, err.message, err.status);
    return fail('BAD_REQUEST', 'Invalid request.', 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ valid: false });

  const found = findReferral(parsed.data.code);
  return json(found ? { valid: true, ...found } : { valid: false });
}
