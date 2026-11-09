import handler from '../../api/submit-loan';
import { estimateMonthlyRepayment } from '../shared/pricing';

const ORIGIN = 'https://selfserve.example.com';
let ipCounter = 0;

function valid(overrides: Record<string, unknown> = {}) {
  const monthly = estimateMonthlyRepayment(200_000, 6, 5, 'Flat Rate');
  return {
    productId: 'ippis-standard',
    appVersion: '0.1.0',
    borrowerBvn: '12345678901',
    borrowerName: 'Ada Obi',
    borrowerPhone: '+2348031112233',
    amountKobo: 200_000 * 100,
    tenorMonths: 6,
    channel: 'ippis',
    employmentType: 'government',
    bankCode: '058',
    accountNumber: '0123456789',
    ippisNumber: '123456',
    employer: null,
    monthlyRepaymentKobo: monthly * 100,
    ratePercent: 5,
    interestModel: 'Flat Rate',
    ...overrides,
  };
}

function req(
  body: unknown,
  opts: { method?: string; headers?: Record<string, string>; raw?: string } = {},
): Request {
  return new Request('https://selfserve.example.com/api/submit-loan', {
    method: opts.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'selfserve.example.com',
      origin: ORIGIN,
      'x-application-token': 'tok',
      'x-forwarded-for': `10.0.0.${++ipCounter}`,
      ...opts.headers,
    },
    body: opts.method === 'GET' ? undefined : (opts.raw ?? JSON.stringify(body)),
  });
}

describe('POST /api/submit-loan', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env['BACKOFFICE_API_URL'] = 'https://backoffice.test';
    process.env['SELFSERVE_INGEST_TOKEN'] = 'secret-ingest-token';
    delete process.env['ALLOWED_ORIGINS'];
    fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ id: 'LN-9' }), { status: 201 })));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('forwards a valid, untampered submission with the server-held token', async () => {
    const res = await handler(req(valid()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'LN-9' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://backoffice.test/api/loans');
    expect(init.headers.Authorization).toBe('Bearer secret-ingest-token');
    expect(init.headers['X-Application-Token']).toBe('tok');
    const sent = JSON.parse(init.body);
    expect(sent.productId).toBeUndefined();
    expect(sent.appVersion).toBe('0.1.0');
    expect(sent.ratePercent).toBe(5);
    expect(sent.feesKobo).toBe(4_000 * 100);
  });

  it('rejects wrong method, foreign origin and missing application token', async () => {
    expect((await handler(req(null, { method: 'GET' }))).status).toBe(405);
    expect((await handler(req(valid(), { headers: { origin: 'https://evil.example' } }))).status).toBe(403);
    expect((await handler(req(valid(), { headers: { origin: '' } }))).status).toBe(403);
    expect((await handler(req(valid(), { headers: { 'x-application-token': '' } }))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects tampered money figures instead of trusting them', async () => {
    const lowRepayment = await handler(req(valid({ monthlyRepaymentKobo: 100 })));
    expect(lowRepayment.status).toBe(409);
    const zeroRate = await handler(req(valid({ ratePercent: 0 })));
    expect(zeroRate.status).toBe(409);
    const wrongModel = await handler(req(valid({ interestModel: 'Reducing Balance' })));
    expect(wrongModel.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects out-of-range amounts, unknown products and mismatched channels', async () => {
    expect((await handler(req(valid({ amountKobo: 1_000_000_00 })))).status).toBe(400);
    expect((await handler(req(valid({ amountKobo: 10_000_00 })))).status).toBe(400);
    expect((await handler(req(valid({ productId: 'free-money' })))).status).toBe(400);
    expect((await handler(req(valid({ channel: 'dedukt' })))).status).toBe(400);
    expect((await handler(req(valid({ employmentType: 'corper' })))).status).toBe(400);
  });

  it('rejects malformed and unexpected fields', async () => {
    expect((await handler(req(valid({ borrowerBvn: '123' })))).status).toBe(400);
    expect((await handler(req(valid({ borrowerPhone: '08031112233' })))).status).toBe(400);
    expect((await handler(req(valid({ tenorMonths: 0 })))).status).toBe(400);
    expect((await handler(req(valid({ isAdmin: true })))).status).toBe(400);
    expect((await handler(req(valid({ appVersion: 'latest' })))).status).toBe(400);
    expect((await handler(req(null, { raw: '{not json' }))).status).toBe(400);
    expect((await handler(req(valid({ borrowerName: 'x'.repeat(9_000) })))).status).toBe(413);
  });

  it('does not leak backoffice error details', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'SQL error at /srv/app/db.ts:44' }), { status: 500 }),
    );
    const res = await handler(req(valid()));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('SQL');

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'dup bvn' }), { status: 409 }));
    const rejected = await handler(req(valid()));
    expect(rejected.status).toBe(422);
    expect(await rejected.text()).not.toContain('dup');
  });

  it('maps an expired verification to 401 and an unreachable backoffice to 502', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    expect((await handler(req(valid()))).status).toBe(401);
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    expect((await handler(req(valid()))).status).toBe(502);
  });

  it('fails closed when the server is not configured', async () => {
    delete process.env['SELFSERVE_INGEST_TOKEN'];
    expect((await handler(req(valid()))).status).toBe(503);
  });

  it('rate limits repeated submissions from one address', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.50' };
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await handler(req(valid(), { headers }))).status);
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });
});
