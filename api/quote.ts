// POST /api/quote: prices a loan on the server. The app shows exactly these figures (monthly repayment, fees, totals
// and the dated schedule) and later steps refer to the returned quoteId. The browser's own sums are only a preview.

import { z } from 'zod';
import { buildQuote, QUOTE_TTL_MS } from '../src/shared/quote';
import { pricingProductById } from '../src/shared/pricing';
import { discountedRate } from '../src/shared/referral';
import { findReferral } from './_lib/referral-codes';
import { signQuote } from './_lib/quote-token';
import { HttpError, clientIp, fail, isSameOrigin, json, rateLimited, readJson } from './_lib/http';

const Body = z
  .object({
    productId: z.string().max(64),
    amount: z.number().int().positive().max(100_000_000),
    tenorMonths: z.number().int().positive().max(60),
    referralCode: z.string().max(40).nullable().optional(),
  })
  .strict();

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'POST only.', 405);
  if (!isSameOrigin(req)) return fail('FORBIDDEN', 'Request not allowed.', 403);
  // A person moving a slider asks often, so the limit is generous; it only stops a script.
  if (await rateLimited(`quote:${clientIp(req)}`, 120, 60_000)) return fail('RATE_LIMITED', 'Too many requests. Try again shortly.', 429);

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

  const product = pricingProductById(b.productId);
  if (!product) return fail('VALIDATION_ERROR', 'Some details are invalid.', 400);
  if (b.amount < product.minAmount || b.amount > product.maxAmount || b.amount % product.amountStep !== 0) {
    return fail('VALIDATION_ERROR', 'Amount is outside the allowed range.', 400);
  }
  if (b.tenorMonths < product.minTenorMonths || b.tenorMonths > product.maxTenorMonths) {
    return fail('VALIDATION_ERROR', 'Repayment period is outside the allowed range.', 400);
  }
  const referral = b.referralCode ? findReferral(b.referralCode) : null;
  if (b.referralCode && !referral) return fail('VALIDATION_ERROR', 'Referral code is not valid.', 400);

  const ratePercent = discountedRate(product.ratePercent, referral);
  const now = new Date();
  const draft = buildQuote(product, b.amount, b.tenorMonths, ratePercent, 'pending', now);
  const quoteId = await signQuote({
    p: product.id,
    a: b.amount * 100,
    t: b.tenorMonths,
    m: draft.monthlyRepayment * 100,
    r: ratePercent,
    x: now.getTime() + QUOTE_TTL_MS,
  });
  if (!quoteId) {
    console.error('quote: QUOTE_SECRET is not set');
    return fail('CONFIG', 'Service unavailable.', 503);
  }
  return json({ quote: { ...draft, quoteId } });
}
