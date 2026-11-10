import handler from '../../api/employment-types';

const get = (origin?: string) =>
  new Request('https://selfserve.example.com/api/employment-types', {
    method: 'GET',
    headers: { host: 'selfserve.example.com', ...(origin ? { origin } : {}), 'x-forwarded-for': `198.18.0.${Math.floor(Math.random() * 250) + 1}` },
  });

describe('GET /api/employment-types', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    process.env['SELF_SERVICE_API_URL'] = 'https://api.test/';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['SELF_SERVICE_API_URL'];
  });

  it('passes on only code and availability', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ code: 'government', name: 'Government', description: 'x', isAvailable: true, sortOrder: 10 }, { nope: 1 }])),
    );
    const res = await handler(get());
    expect(await res.json()).toEqual({ types: [{ code: 'government', isAvailable: true }] });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/employment-types');
  });

  it('answers 503 when the API address is not set and 502 when it fails', async () => {
    delete process.env['SELF_SERVICE_API_URL'];
    expect((await handler(get())).status).toBe(503);
    process.env['SELF_SERVICE_API_URL'] = 'https://api.test';
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    expect((await handler(get())).status).toBe(502);
  });

  it('refuses a foreign origin', async () => {
    expect((await handler(get('https://evil.example'))).status).toBe(403);
  });
});
