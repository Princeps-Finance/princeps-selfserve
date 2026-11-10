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
  verifyCaptcha,
  rateLimited,
  readJson,
} from '../_lib/http';

export const config = { runtime: 'nodejs' };

const phone = z.string().regex(/^\+234[789]\d{9}$/);
const digits = (n: number) => z.string().regex(new RegExp(`^\\d{${n}}$`));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

interface OpDef {
  schema: z.ZodTypeAny;
  /** Max requests per IP per minute. */
  limit: number;
  /** Response keys passed back to the browser. */
  allow: string[];
  /** Needs the application token issued after a verified OTP. Stops anonymous probing. */
  needsToken?: boolean;
  /** Creates something, so the caller must send an Idempotency-Key and the back office must honour it. */
  idempotent?: boolean;
}

const OPS: Record<string, OpDef> = {
  'lookup-contact': {
    schema: z.object({ phone, email: z.string().email().max(160).optional() }).strict(),
    limit: 10,
    allow: ['kind', 'profileHint', 'snapshot'],
    needsToken: true,
  },
  'send-otp': {
    schema: z.object({ phone, captchaToken: z.string().max(2048).optional() }).strict(),
    limit: 3,
    allow: ['target', 'expiresInSeconds'],
  },
  'verify-otp': {
    schema: z.object({ phone, code: digits(6) }).strict(),
    limit: 6,
    allow: ['status', 'retryAfterSeconds', 'token'],
  },
  // Masked phones and emails tied to a BVN, so the customer can choose where the code goes. Only masked values ever leave the server.
  'bvn-contacts': {
    schema: z.object({ bvn: digits(11), captchaToken: z.string().max(2048).optional() }).strict(),
    limit: 3,
    allow: ['status', 'phones', 'emails'],
  },
  'send-bvn-otp': {
    schema: z
      .object({
        bvn: digits(11),
        captchaToken: z.string().max(2048).optional(),
        destination: z
          .discriminatedUnion('kind', [
            z.object({ kind: z.literal('bvn-contact'), id: z.string().max(64) }).strict(),
            z.object({ kind: z.literal('alternate-phone'), phone }).strict(),
          ])
          .optional(),
      })
      .strict(),
    limit: 3,
    allow: ['status', 'target', 'expiresInSeconds'],
  },
  'verify-bvn-otp': {
    schema: z.object({ bvn: digits(11), code: digits(6) }).strict(),
    limit: 6,
    // identity carries name, date of birth and address. The BVN photo is never passed through.
    allow: ['status', 'retryAfterSeconds', 'token', 'identity'],
  },
  'statement-review': {
    schema: z
      .object({
        contact: z.object({ phone, email: z.string().email().max(160).optional() }).strict(),
        bvn: digits(11),
        employer: z.string().min(2).max(120),
        bankCode: digits(3),
        fileName: z.string().min(1).max(200),
        sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
      })
      .strict(),
    limit: 5,
    allow: ['status', 'referenceId'],
    needsToken: true,
    idempotent: true,
  },
  lgas: { schema: z.object({ state: z.string().min(2).max(40) }).strict(), limit: 30, allow: ['lgas'] },
  banks: { schema: z.object({}).strict(), limit: 30, allow: ['banks'] },
  'verify-salary': {
    schema: z
      .object({
        channel: z.enum(['ippis', 'remita', 'dedukt']),
        bankCode: digits(3),
        accountNumber: digits(10),
        fullName: z.string().trim().min(2).max(120),
        ippisNumber: z.string().regex(/^\d{4,20}$/).optional(),
        employer: z.string().max(120).optional(),
      })
      .strict(),
    limit: 6,
    allow: ['status', 'monthlyIncome', 'accountName'],
    needsToken: true,
  },
  // Identity checks need the claimed name AND date of birth, and answer match / no-match
  // only. Nothing about the record holder is ever returned, so these cannot be used to
  // look a stranger up (an attacker with only a BVN learns nothing).
  'verify-bvn': {
    schema: z.object({ bvn: digits(11), fullName: z.string().trim().min(2).max(120), dateOfBirth: isoDate }).strict(),
    limit: 5,
    allow: ['status'],
    needsToken: true,
  },
  // The customer's loans from Caltos. The back office must answer POST /api/selfserve/list-loans for the token holder.
  'list-loans': {
    schema: z.object({}).strict(),
    limit: 10,
    allow: ['loans'],
    needsToken: true,
  },
  'verify-nin': {
    schema: z.object({ nin: digits(11), fullName: z.string().trim().min(2).max(120), dateOfBirth: isoDate }).strict(),
    limit: 5,
    allow: ['status'],
    needsToken: true,
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
    needsToken: true,
  },
  'mandate-link': {
    schema: z
      .object({
        productId: z.string().max(64),
        channel: z.enum(['ippis', 'remita', 'dedukt']),
        monthlyAmount: z.number().int().positive().max(10_000_000),
        tenorMonths: z.number().int().min(1).max(60),
      })
      .strict(),
    limit: 6,
    allow: ['url', 'reference'],
    needsToken: true,
    idempotent: true,
  },
  'mandate-status': {
    schema: z.object({ reference: z.string().regex(/^[\w-]{3,64}$/) }).strict(),
    limit: 40,
    allow: ['status'],
    needsToken: true,
  },
  waitlist: {
    schema: z
      .object({
        phone,
        email: z.string().email().max(160).optional(),
        type: z.string().max(40),
        employer: z.string().max(120).optional(),
        incomeBand: z.enum(['under-100k', '100-250k', '250-500k', '500-1m', 'over-1m']).optional(),
        channel: z.enum(['whatsapp', 'sms', 'email']),
      })
      .strict(),
    limit: 5,
    allow: ['status', 'referenceId', 'positionInQueue', 'estimatedWindow'],
    needsToken: true,
    idempotent: true,
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

  // Calls that create something must carry a key, so a retry can never create a second one.
  const idempotencyKey = req.headers.get('idempotency-key');
  if (def.idempotent && !(idempotencyKey && UUID.test(idempotencyKey))) {
    return fail('IDEMPOTENCY_KEY_REQUIRED', 'Send a valid Idempotency-Key.', 400);
  }

  const token = req.headers.get('x-application-token');
  if (def.needsToken && (!token || token.length > 512)) {
    return fail('UNVERIFIED', 'Verify your phone number first.', 401);
  }

  // Bot check before sending an SMS (costs money and can harass a victim).
  let payload = parsed.data as Record<string, unknown>;
  if (op === 'send-otp' || op === 'send-bvn-otp' || op === 'bvn-contacts') {
    const { captchaToken, ...rest } = payload as { captchaToken?: string };
    if (!(await verifyCaptcha(captchaToken, ip))) {
      return fail('CAPTCHA', 'Please confirm you are not a robot and try again.', 400);
    }
    payload = rest;
  }

  // Per-phone limits stop one number being hammered from many IPs.
  const target = (parsed.data as { phone?: string; bvn?: string }).phone ?? (parsed.data as { bvn?: string }).bvn;
  if (target && (op === 'send-otp' || op === 'verify-otp' || op === 'send-bvn-otp' || op === 'verify-bvn-otp' || op === 'bvn-contacts') && rateLimited(`${op}:${target}`, def.limit * 2, 10 * 60_000)) {
    return fail('RATE_LIMITED', 'Too many attempts. Try again shortly.', 429);
  }

  const upstream = await callBackoffice(
    cfg,
    `/api/selfserve/${op}`,
    payload,
    {
      ...(token && token.length <= 512 ? { 'X-Application-Token': token } : {}),
      ...(def.idempotent && idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
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
