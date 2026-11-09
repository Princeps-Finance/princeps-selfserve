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
    await handler(req('verify-nin', { nin: '12345678901' }, { 'x-application-token': 'tok-1' }));
    expect(fetchMock.mock.calls[0][1].headers['X-Application-Token']).toBe('tok-1');
  });

  it('rejects unknown operations (including prototype keys), bad input and foreign origins', async () => {
    expect((await handler(req('drop-tables', {}))).status).toBe(404);
    expect((await handler(req('constructor', {}))).status).toBe(404);
    expect((await handler(req('verify-bvn', { bvn: '1' }))).status).toBe(400);
    expect((await handler(req('verify-bvn', { bvn: '12345678901', extra: 1 }))).status).toBe(400);
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

  it('returns a generic 502 when the backoffice errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ stack: 'at db.ts:1' }), { status: 500 }));
    const res = await handler(req('banks', {}));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('db.ts');
  });
});
