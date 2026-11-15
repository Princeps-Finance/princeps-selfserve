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

  const envelope = (data: unknown) => new Response(JSON.stringify({ statusCode: 200, code: 'SUCCESS', message: 'Success', data, status: 'success', timestamp: '2026-11-15T12:00:00Z' }));

  it('reads the v2 list and gives the app only code and availability, in the app\'s own names', async () => {
    fetchMock.mockResolvedValueOnce(
      envelope([
        { code: 'federal', name: 'Federal government', description: 'x', status: 'AVAILABLE' },
        { code: 'state', name: 'State government', description: 'x', status: 'AVAILABLE' },
        { code: 'paramilitary', name: 'Paramilitary', description: 'x', status: 'AVAILABLE' },
        { code: 'nysc', name: 'NYSC Corper', description: 'x', status: 'AVAILABLE' },
        { code: 'private-sector', name: 'Private sector', description: 'x', status: 'COMING_SOON' },
        { code: 'unknown-new-type', status: 'AVAILABLE' },
        { nope: 1 },
      ]),
    );
    const res = await handler(get());
    expect(await res.json()).toEqual({
      types: [
        { code: 'government', isAvailable: true },
        { code: 'paramilitary', isAvailable: true },
        { code: 'nysc-corper', isAvailable: true },
        { code: 'private-sector', isAvailable: false },
      ],
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v2/employment-types');
  });

  it('keeps government open when only one of federal and state is', async () => {
    fetchMock.mockResolvedValueOnce(envelope([{ code: 'federal', status: 'AVAILABLE' }, { code: 'state', status: 'COMING_SOON' }]));
    expect(await (await handler(get())).json()).toEqual({ types: [{ code: 'government', isAvailable: true }] });
  });

  it('tolerates the address ending in a slash or in /api/v2', async () => {
    process.env['SELF_SERVICE_API_URL'] = 'https://api.test/api/v2/';
    fetchMock.mockResolvedValueOnce(envelope([{ code: 'nysc', status: 'AVAILABLE' }]));
    await handler(get());
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/v2/employment-types');
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
