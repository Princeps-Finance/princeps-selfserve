import handler from '../../api/selfserve/[op]';

let ip = 0;
function req(op: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://selfserve.example.com/api/selfserve/${op}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'selfserve.example.com',
      origin: 'https://selfserve.example.com',
      'x-forwarded-for': `198.51.100.${++ip}`,
      'idempotency-key': '5b1f2a40-1c3d-4e7a-9a52-7d1e2f3a4b5c',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/selfserve/[op]', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    process.env['BACKOFFICE_API_URL'] = 'https://backoffice.test/';
    process.env['SELFSERVE_INGEST_TOKEN'] = 'secret';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('forwards a valid call and strips response keys outside the allow-list', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ target: '+234 •••••• 33', expiresInSeconds: 300, otp: '123456', debug: true })),
    );
    const res = await handler(req('send-otp', { phone: '+2348031112233' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ target: '+234 •••••• 33', expiresInSeconds: 300 });
    expect(fetchMock.mock.calls[0][0]).toBe('https://backoffice.test/api/selfserve/send-otp');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer secret');
  });

  it('passes the application token through to the backoffice', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' })));
    await handler(req('verify-nin', { nin: '12345678901', fullName: 'Ada Obi', dateOfBirth: '1990-01-01' }, { 'x-application-token': 'tok-1' }));
    expect(fetchMock.mock.calls[0][1].headers['X-Application-Token']).toBe('tok-1');
  });

  it('rejects unknown operations (including prototype keys), bad input and foreign origins', async () => {
    expect((await handler(req('drop-tables', {}))).status).toBe(404);
    expect((await handler(req('constructor', {}))).status).toBe(404);
    expect((await handler(req('verify-bvn', { bvn: '1' }, { 'x-application-token': 't' }))).status).toBe(400);
    expect((await handler(req('verify-bvn', { bvn: '12345678901', fullName: 'Ada Obi', dateOfBirth: '1990-01-01', extra: 1 }, { 'x-application-token': 't' }))).status).toBe(400);
    expect((await handler(req('send-otp', { phone: '+2348031112233' }, { origin: 'https://evil.example' }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rate limits OTP sends per address and per phone number', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ target: 'x', expiresInSeconds: 1 }))));
    const sameIp = { 'x-forwarded-for': '192.0.2.77' };
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await handler(req('send-otp', { phone: `+23480311122${30 + i}` }, sameIp))).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);

    const phone = { phone: '+2348099999999' };
    const perPhone: number[] = [];
    for (let i = 0; i < 8; i++) perPhone.push((await handler(req('send-otp', phone))).status);
    expect(perPhone.filter((s) => s === 429).length).toBeGreaterThan(0);
  });

  it('caps guesses at a code per number from any address, so rotating addresses does not help', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ status: 'wrong' }))));
    const phone = '+2348055550001';
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await handler(req('verify-otp', { phone, code: '000000' }))).status);
    expect(codes).toEqual([200, 200, 200, 200, 200, 429, 429]);
  });

  it('limits identity checks per BVN and per token, not only per address', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ status: 'name-mismatch' }))));
    const body = { bvn: '22222222221', fullName: 'Ada Obi', dateOfBirth: '1990-01-01' };
    const perBvn: number[] = [];
    for (let i = 0; i < 12; i++) perBvn.push((await handler(req('verify-bvn', body, { 'x-application-token': `tok-a${i}` }))).status);
    expect(perBvn.filter((s) => s === 429).length).toBeGreaterThan(0);

    const perToken: number[] = [];
    for (let i = 0; i < 20; i++) {
      const b = { ...body, bvn: `3333333${String(1000 + i)}` };
      perToken.push((await handler(req('verify-bvn', b, { 'x-application-token': 'tok-same' }))).status);
    }
    expect(perToken.filter((s) => s === 429).length).toBeGreaterThan(0);
  });

  describe('shared limit store', () => {
    afterEach(() => {
      delete process.env['VERCEL_ENV'];
      delete process.env['UPSTASH_REDIS_REST_URL'];
      delete process.env['UPSTASH_REDIS_REST_TOKEN'];
    });

    it('refuses every limited call in production when the store is not configured', async () => {
      process.env['VERCEL_ENV'] = 'production';
      const res = await handler(req('banks', {}));
      expect(res.status).toBe(429);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('counts in Redis when it is configured, with hashed keys, and refuses when the store is down', async () => {
      process.env['UPSTASH_REDIS_REST_URL'] = 'https://redis.test';
      process.env['UPSTASH_REDIS_REST_TOKEN'] = 'rt';
      fetchMock.mockImplementation((url: string) =>
        Promise.resolve(
          String(url).startsWith('https://redis.test')
            ? new Response(JSON.stringify([{ result: 1 }, { result: 1 }]))
            : new Response(JSON.stringify({ lgas: [] })),
        ),
      );
      const ok = await handler(req('lgas', { state: 'Lagos' }));
      expect(ok.status).toBe(200);
      const redisCall = fetchMock.mock.calls.find((c) => String(c[0]).startsWith('https://redis.test'));
      expect(String(redisCall?.[1].body)).not.toContain('Lagos');

      fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
      const down = await handler(req('lgas', { state: 'Lagos' }));
      expect(down.status).toBe(429);
    });
  });

  it('runs the eligibility check without a token, passes on the maximum and verified pay but not the account name, and limits it per account', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'ok', decision: 'approved', maxAmount: 300000, tenorMonths: 12, monthlyIncome: 250000, accountName: 'Ada Obi' }))),
    );
    const body = { employmentType: 'government', governmentLevel: 'federal', channel: 'ippis', bankCode: '058', accountNumber: '0123456789', ippisNumber: '445566' };
    const res = await handler(req('eligibility-check', body));
    expect(await res.json()).toEqual({ status: 'ok', decision: 'approved', maxAmount: 300000, tenorMonths: 12, monthlyIncome: 250000 });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await handler(req('eligibility-check', body))).status);
    expect(codes).toContain(429);
  it('accepts a push subscription only with a token and an https endpoint', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok', extra: 1 }))));
    const body = { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'k', auth: 'a' } };
    expect((await handler(req('push-subscribe', body))).status).toBe(401);
    expect((await handler(req('push-subscribe', { ...body, endpoint: 'http://push.example.com/abc' }, { 'x-application-token': 't-push-1' }))).status).toBe(400);
    const ok = await handler(req('push-subscribe', body, { 'x-application-token': 't-push-2' }));
    expect(await ok.json()).toEqual({ status: 'ok' });
  });

  it('returns a generic 502 when the backoffice errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ stack: 'at db.ts:1' }), { status: 500 }));
    const res = await handler(req('banks', {}));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('db.ts');
  });

  describe('anti-fraud', () => {
    const tok = { 'x-application-token': 'tok' };
    const bvn = { bvn: '12345678901', fullName: 'Ada Obi', dateOfBirth: '1990-01-01' };

    it('BVN and NIN checks need name and date of birth, so a bare number cannot look anyone up', async () => {
      expect((await handler(req('verify-bvn', { bvn: '12345678901' }, tok))).status).toBe(400);
      expect((await handler(req('verify-bvn', { bvn: '12345678901', fullName: 'Ada Obi' }, tok))).status).toBe(400);
      expect((await handler(req('verify-nin', { nin: '12345678901', fullName: 'Ada Obi' }, tok))).status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('never returns the record holder\'s name, birth date, phone or address', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'name-mismatch', matchedName: 'Real Person', dateOfBirth: '1980-02-02', phone: '+2348000000000', address: { street: 'x' } })),
      );
      const res = await handler(req('verify-bvn', bvn, tok));
      expect(await res.json()).toEqual({ status: 'name-mismatch' });
    });

    it('identity, salary, lookup, mandate and waitlist calls need the token from a verified OTP', async () => {
      const calls: [string, unknown][] = [
        ['lookup-contact', { phone: '+2348031112233', email: 'a@b.co' }],
        ['verify-bvn', bvn],
        ['verify-nin', { nin: '12345678901', fullName: 'Ada Obi', dateOfBirth: '1990-01-01' }],
        ['verify-salary', { channel: 'ippis', bankCode: '058', accountNumber: '0123456789', fullName: 'Ada Obi' }],
        ['mandate-status', { reference: 'MD-123' }],
      ];
      for (const [op, body] of calls) expect((await handler(req(op, body))).status, op).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not require the token for the calls that happen before OTP (send-otp, banks)', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ banks: [], target: 'x', expiresInSeconds: 1 }))));
      expect((await handler(req('banks', {}))).status).toBe(200);
      expect((await handler(req('send-otp', { phone: '+2348077777777' }))).status).toBe(200);
    });

    it('enforces the bot check before sending an SMS when it is configured', async () => {
      process.env['TURNSTILE_SECRET'] = 'ts-secret';
      try {
        const noToken = await handler(req('send-otp', { phone: '+2348012345678' }));
        expect(noToken.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();

        fetchMock.mockImplementation((url: string) =>
          Promise.resolve(
            new Response(JSON.stringify(String(url).includes('turnstile') ? { success: false } : { target: 'x', expiresInSeconds: 1 })),
          ),
        );
        const bad = await handler(req('send-otp', { phone: '+2348012345679', captchaToken: 'bad' }));
        expect(bad.status).toBe(400);

        fetchMock.mockImplementation((url: string) =>
          Promise.resolve(
            new Response(JSON.stringify(String(url).includes('turnstile') ? { success: true } : { target: 'x', expiresInSeconds: 1 })),
          ),
        );
        const good = await handler(req('send-otp', { phone: '+2348012345680', captchaToken: 'ok' }));
        expect(good.status).toBe(200);
        // The token is for us, not for the backoffice.
        const forwarded = JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
        expect(forwarded.captchaToken).toBeUndefined();
      } finally {
        delete process.env['TURNSTILE_SECRET'];
      }
    });

    it('validates mandate link requests', async () => {
      expect((await handler(req('mandate-link', { productId: 'p', channel: 'nope', monthlyAmount: 1, tenorMonths: 6 }, tok))).status).toBe(400);
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://bank.example/m', reference: 'MD-1', secret: 'x' })));
      const ok = await handler(req('mandate-link', { productId: 'p', channel: 'ippis', monthlyAmount: 31966, tenorMonths: 12 }, tok));
      expect(await ok.json()).toEqual({ url: 'https://bank.example/m', reference: 'MD-1' });
    });
  });

  it('refuses a call that creates something without an Idempotency-Key, and forwards the key when given', async () => {
    const noKey = await handler(req('mandate-link', { productId: 'p', channel: 'ippis', monthlyAmount: 31966, tenorMonths: 12 }, { 'x-application-token': 'tok', 'idempotency-key': '' }));
    expect(noKey.status).toBe(400);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://pay.test/x', reference: 'MND-123' })));
    const ok = await handler(req('mandate-link', { productId: 'p', channel: 'ippis', monthlyAmount: 31966, tenorMonths: 12 }, { 'x-application-token': 'tok' }));
    expect(ok.status).toBe(200);
    expect(fetchMock.mock.calls.at(-1)![1].headers['Idempotency-Key']).toBe('5b1f2a40-1c3d-4e7a-9a52-7d1e2f3a4b5c');
  });
});
