import handler from '../../api/quote';
import { verifyQuote } from '../../api/_lib/quote-token';
import { estimateMonthlyRepayment } from '../shared/pricing';

const ORIGIN = 'https://selfserve.example.com';
let ip = 0;

function req(body: unknown, opts: { method?: string; origin?: string | null } = {}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json', host: 'selfserve.example.com', 'x-forwarded-for': `10.1.0.${++ip}` };
  if (opts.origin !== null) headers['origin'] = opts.origin ?? ORIGIN;
  return new Request('https://selfserve.example.com/api/quote', { method: opts.method ?? 'POST', headers, body: opts.method === 'GET' ? undefined : JSON.stringify(body) });
}

describe('POST /api/quote', () => {
  beforeEach(() => {
    delete process.env['ALLOWED_ORIGINS'];
    delete process.env['QUOTE_SECRET'];
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('prices the loan on the server, with a dated schedule that adds up', async () => {
    const res = await handler(req({ productId: 'ippis-standard', amount: 200_000, tenorMonths: 6 }));
    expect(res.status).toBe(200);
    const { quote } = (await res.json()) as { quote: Record<string, unknown> & { schedule: { dueDate: string; payment: number }[] } };
    const monthly = estimateMonthlyRepayment(200_000, 6, 5, 'Flat Rate');
    expect(quote['monthlyRepayment']).toBe(monthly);
    expect(quote['totalRepayable']).toBe(monthly * 6);
    expect(quote.schedule).toHaveLength(6);
    expect(quote.schedule.every((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.dueDate) && l.payment === monthly)).toBe(true);
    expect(String(quote['quoteId'])).toContain('.');
  });

  it('signs the quote id so the figures cannot be changed afterwards', async () => {
    const res = await handler(req({ productId: 'ippis-standard', amount: 200_000, tenorMonths: 6 }));
    const { quote } = (await res.json()) as { quote: { quoteId: string; monthlyRepayment: number } };
    const claims = await verifyQuote(quote.quoteId);
    expect(claims).toMatchObject({ p: 'ippis-standard', a: 200_000 * 100, t: 6, m: quote.monthlyRepayment * 100 });
    const [body, sig] = quote.quoteId.split('.');
    expect(await verifyQuote(`${body}.${sig.slice(0, -2)}AA`)).toBeNull();
    expect(await verifyQuote('not-a-token')).toBeNull();
  });

  it('applies a known referral code and refuses an unknown one', async () => {
    const plain = (await (await handler(req({ productId: 'ippis-standard', amount: 200_000, tenorMonths: 6 }))).json()) as { quote: { monthlyRepayment: number } };
    const coded = (await (await handler(req({ productId: 'ippis-standard', amount: 200_000, tenorMonths: 6, referralCode: 'PRINCEPS10' }))).json()) as { quote: { monthlyRepayment: number; ratePercent: number } };
    expect(coded.quote.monthlyRepayment).toBeLessThan(plain.quote.monthlyRepayment);
    expect((await handler(req({ productId: 'ippis-standard', amount: 200_000, tenorMonths: 6, referralCode: 'NOPE' }))).status).toBe(400);
  });

  it('refuses amounts and periods outside the product limits, unknown products and stray fields', async () => {
    expect((await handler(req({ productId: 'ippis-standard', amount: 1, tenorMonths: 6 }))).status).toBe(400);
    expect((await handler(req({ productId: 'ippis-standard', amount: 200_000, tenorMonths: 99 }))).status).toBe(400);
    expect((await handler(req({ productId: 'nope', amount: 200_000, tenorMonths: 6 }))).status).toBe(400);
    expect((await handler(req({ productId: 'ippis-standard', amount: 200_000, tenorMonths: 6, extra: 1 }))).status).toBe(400);
  });

  it('answers only POST requests from the app itself', async () => {
    expect((await handler(req({}, { method: 'GET' }))).status).toBe(405);
    expect((await handler(req({ productId: 'ippis-standard', amount: 200_000, tenorMonths: 6 }, { origin: null }))).status).toBe(403);
  });

  it('refuses to issue quotes in production without its own secret', async () => {
    process.env['APP_ENV'] = 'production';
    process.env['UPSTASH_REDIS_REST_URL'] = '';
    const res = await handler(req({ productId: 'ippis-standard', amount: 200_000, tenorMonths: 6 }));
    expect([429, 503]).toContain(res.status);
    delete process.env['APP_ENV'];
  });
});
