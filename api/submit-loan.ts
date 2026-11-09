// Vercel Function: validates a loan submission, recomputes every money figure
// from the shared pricing catalogue, and forwards it to princeps-backoffice
// with the ingest token (which never reaches the browser).
//
// Trust model: the browser is untrusted. Amounts, rate, model and repayment
// are recomputed here from the product id; anything that disagrees with the
// catalogue is rejected. Identity checks (OTP/BVN/NIN) are enforced by the
// backoffice through the opaque application token the client must present.

import { z } from 'zod';
import {
  MAX_TENOR_MONTHS,
  MIN_TENOR_MONTHS,
  calcProductFees,
  estimateMonthlyRepayment,
  pricingProductById,
} from '../src/shared/pricing';
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
} from './_lib/http';

export const config = { runtime: 'nodejs' };

const digits = (n: number) => z.string().regex(new RegExp(`^\\d{${n}}$`));

const Body = z
  .object({
    productId: z.string().max(64),
    borrowerBvn: digits(11),
    borrowerName: z.string().trim().min(2).max(120),
    borrowerPhone: z.string().regex(/^\+234[789]\d{9}$/),
    amountKobo: z.number().int().positive(),
    tenorMonths: z.number().int().min(MIN_TENOR_MONTHS).max(MAX_TENOR_MONTHS),
    channel: z.enum(['ippis', 'remita', 'dedukt']),
    employmentType: z.enum(['government', 'paramilitary', 'corper']),
    bankCode: digits(3).nullable(),
    accountNumber: digits(10).nullable(),
    ippisNumber: z.string().regex(/^\d{4,20}$/).nullable(),
    employer: z.string().trim().max(120).nullable(),
    // Figures the client computed. Accepted only so we can reject tampering.
    monthlyRepaymentKobo: z.number().int().positive(),
    ratePercent: z.number(),
    interestModel: z.string().max(40),
  })
  .strict();

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'POST only.', 405);
  if (!isSameOrigin(req)) return fail('FORBIDDEN', 'Request not allowed.', 403);

  const ip = clientIp(req);
  if (rateLimited(`submit:${ip}`, 5, 10 * 60_000)) {
    return fail('RATE_LIMITED', 'Too many attempts. Try again later.', 429);
  }

  const cfg = backofficeConfig();
  if (!cfg) {
    console.error('submit-loan: BACKOFFICE_API_URL / SELFSERVE_INGEST_TOKEN not set');
    return fail('CONFIG', 'Service unavailable.', 503);
  }

  const appToken = req.headers.get('x-application-token');
  if (!appToken || appToken.length > 512) {
    return fail('UNVERIFIED', 'Verification required before submitting.', 401);
  }

  let raw: unknown;
  try {
    raw = await readJson(req);
  } catch (err) {
    if (err instanceof HttpError) return fail(err.code, err.message, err.status);
    return fail('BAD_REQUEST', 'Invalid request.', 400);
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail('VALIDATION_ERROR', 'Some details are invalid.', 400);
  const b = parsed.data;

  // ---- Authoritative pricing --------------------------------------------
  const product = pricingProductById(b.productId);
  if (
    !product ||
    product.channel !== b.channel ||
    !product.employmentTypes.includes(b.employmentType)
  ) {
    return fail('VALIDATION_ERROR', 'Some details are invalid.', 400);
  }
  if (b.amountKobo % 100 !== 0) return fail('VALIDATION_ERROR', 'Some details are invalid.', 400);
  const amount = b.amountKobo / 100;
  if (amount < product.minAmount || amount > product.maxAmount) {
    return fail('VALIDATION_ERROR', 'Amount is outside the allowed range.', 400);
  }
  const monthly = estimateMonthlyRepayment(
    amount,
    b.tenorMonths,
    product.ratePercent,
    product.interestModel,
  );
  if (
    b.monthlyRepaymentKobo !== monthly * 100 ||
    b.ratePercent !== product.ratePercent ||
    b.interestModel !== product.interestModel
  ) {
    console.warn('submit-loan: client pricing mismatch', product.id);
    return fail('VALIDATION_ERROR', 'Offer is out of date. Please restart your application.', 409);
  }

  const payload = {
    borrowerBvn: b.borrowerBvn,
    borrowerName: b.borrowerName,
    borrowerPhone: b.borrowerPhone,
    amountKobo: b.amountKobo,
    tenorMonths: b.tenorMonths,
    monthlyRepaymentKobo: monthly * 100,
    interestModel: product.interestModel,
    ratePercent: product.ratePercent,
    channel: product.channel,
    bankCode: b.bankCode,
    accountNumber: b.accountNumber,
    ippisNumber: b.ippisNumber,
    employmentType: b.employmentType,
    employer: b.employer,
    feesKobo: calcProductFees(product, amount).reduce((s, f) => s + f.amount * 100, 0),
  };

  const upstream = await callBackoffice(cfg, '/api/loans', payload, {
    'X-Application-Token': appToken,
  });
  if (!upstream) return fail('UPSTREAM_DOWN', 'Service unavailable. Try again shortly.', 502);

  if (upstream.status >= 200 && upstream.status < 300) {
    const id = (upstream.data as { id?: unknown } | null)?.id;
    if (typeof id !== 'string') return fail('UPSTREAM_BAD', 'Service unavailable.', 502);
    return json({ id });
  }
  console.error('submit-loan: backoffice rejected', upstream.status);
  if (upstream.status === 401 || upstream.status === 403) {
    return fail('UNVERIFIED', 'Verification expired. Please restart your application.', 401);
  }
  if (upstream.status >= 400 && upstream.status < 500) {
    return fail('REJECTED', 'Application could not be processed.', 422);
  }
  return fail('UPSTREAM_DOWN', 'Service unavailable. Try again shortly.', 502);
}
