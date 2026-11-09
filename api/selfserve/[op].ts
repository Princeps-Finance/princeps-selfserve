// Vercel Function: validated, rate-limited proxy for the identity and
// verification calls (OTP, BVN, NIN, salary, waitlist...) that the browser
// may not make directly. The backoffice implements POST /api/selfserve/<op>
// and returns the JSON shapes documented in API.md. Responses are filtered to
// an allow-list so nothing unexpected reaches the browser.

import { z } from 'zod';
import {
  HttpError,
  backofficeConfig,
  callBackoffice,
  clientIp,
  fail,
  isSameOrigin,
  json,
  rateLimited,
  readJson,
} from '../_lib/http';

export const config = { runtime: 'nodejs' };

const phone = z.string().regex(/^\+234[789]\d{9}$/);
const digits = (n: number) => z.string().regex(new RegExp(`^\\d{${n}}$`));

interface OpDef {
  schema: z.ZodTypeAny;
  /** Max requests per IP per minute. */
  limit: number;
  /** Response keys passed back to the browser. */
  allow: string[];
}

const OPS: Record<string, OpDef> = {
  'lookup-contact': {
    schema: z.object({ phone, email: z.string().email().max(160) }).strict(),
    limit: 10,
    allow: ['kind', 'profileHint', 'snapshot'],
  },
  'send-otp': {
    schema: z.object({ phone }).strict(),
    limit: 3,
    allow: ['target', 'expiresInSeconds'],
  },
  'verify-otp': {
    schema: z.object({ phone, code: digits(6) }).strict(),
    limit: 6,
    allow: ['status', 'retryAfterSeconds', 'token'],
  },
  banks: { schema: z.object({}).strict(), limit: 30, allow: ['banks'] },
  'verify-salary': {
    schema: z
      .object({
        channel: z.enum(['ippis', 'remita', 'dedukt']),
        bankCode: digits(3),
        accountNumber: digits(10),
        ippisNumber: z.string().regex(/^\d{4,20}$/).optional(),
        employer: z.string().max(120).optional(),
      })
      .strict(),
    limit: 6,
    allow: ['status', 'monthlyIncome', 'accountName'],
  },
  'verify-bvn': {
    schema: z.object({ bvn: digits(11), fullName: z.string().max(120).optional() }).strict(),
    limit: 5,
    allow: ['status', 'matchedName', 'dateOfBirth', 'phone', 'address'],
  },
  'verify-nin': {
    schema: z.object({ nin: digits(11), fullName: z.string().max(120).optional() }).strict(),
    limit: 5,
    allow: ['status', 'matchedName'],
  },
  'upload-document': {
    schema: z
      .object({
        docId: z.string().max(64),
        fileName: z.string().max(200),
        sizeBytes: z.number().int().nonnegative().max(25 * 1024 * 1024),
      })
      .strict(),
    limit: 20,
    allow: ['status'],
  },
  waitlist: {
    schema: z
      .object({
        phone,
        email: z.string().email().max(160),
        type: z.string().max(40),
        employer: z.string().max(120).optional(),
        incomeBand: z.enum(['under-100k', '100-250k', '250-500k', '500-1m', 'over-1m']).optional(),
        channel: z.enum(['whatsapp', 'sms', 'email']),
      })
      .strict(),
    limit: 5,
    allow: ['status', 'referenceId', 'positionInQueue', 'estimatedWindow'],
  },
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'POST only.', 405);
  if (!isSameOrigin(req)) return fail('FORBIDDEN', 'Request not allowed.', 403);

  const op = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? '';
  const def = Object.hasOwn(OPS, op) ? OPS[op] : undefined;
  if (!def) return fail('NOT_FOUND', 'Unknown operation.', 404);

  const ip = clientIp(req);
  if (rateLimited(`${op}:${ip}`, def.limit)) {
    return fail('RATE_LIMITED', 'Too many attempts. Try again shortly.', 429);
  }

  const cfg = backofficeConfig();
  if (!cfg) {
    console.error('selfserve: BACKOFFICE_API_URL / SELFSERVE_INGEST_TOKEN not set');
    return fail('CONFIG', 'Service unavailable.', 503);
  }

  let raw: unknown;
  try {
    raw = await readJson(req);
  } catch (err) {
    if (err instanceof HttpError) return fail(err.code, err.message, err.status);
    return fail('BAD_REQUEST', 'Invalid request.', 400);
  }
  const parsed = def.schema.safeParse(raw);
  if (!parsed.success) return fail('VALIDATION_ERROR', 'Some details are invalid.', 400);

  // Per-phone limits stop one number being hammered from many IPs.
  const target = (parsed.data as { phone?: string }).phone;
  if (target && (op === 'send-otp' || op === 'verify-otp') && rateLimited(`${op}:${target}`, def.limit * 2, 10 * 60_000)) {
    return fail('RATE_LIMITED', 'Too many attempts. Try again shortly.', 429);
  }

  const token = req.headers.get('x-application-token');
  const upstream = await callBackoffice(
    cfg,
    `/api/selfserve/${op}`,
    parsed.data,
    token && token.length <= 512 ? { 'X-Application-Token': token } : {},
  );
  if (!upstream) return fail('UPSTREAM_DOWN', 'Service unavailable. Try again shortly.', 502);
  if (upstream.status < 200 || upstream.status >= 300 || typeof upstream.data !== 'object' || !upstream.data) {
    console.error('selfserve: backoffice error', op, upstream.status);
    return fail('UPSTREAM_DOWN', 'Service unavailable. Try again shortly.', 502);
  }

  const out: Record<string, unknown> = {};
  for (const key of def.allow) {
    if (key in upstream.data) out[key] = (upstream.data as Record<string, unknown>)[key];
  }
  return json(out);
}
