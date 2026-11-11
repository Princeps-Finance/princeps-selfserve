import { describe, expect, it } from 'vitest';
import { handler, toRequest, type ApiEvent } from '../../aws/handler';
import { clientIp } from '../../api/_lib/http';

const event = (over: Partial<ApiEvent> = {}): ApiEvent => ({
  rawPath: '/api/nope',
  headers: { host: 'api.example.com' },
  requestContext: { http: { method: 'GET' } },
  ...over,
});

describe('lambda handler', () => {
  it('answers an unknown route with 404 JSON', async () => {
    const res = await handler(event());
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe('NOT_FOUND');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rebuilds the method, path, query, headers and a base64 body', async () => {
    const req = toRequest(
      event({
        rawPath: '/api/referral',
        rawQueryString: 'a=1',
        headers: { host: 'api.example.com', origin: 'https://app.example.com' },
        body: Buffer.from('{"code":"ABC"}').toString('base64'),
        isBase64Encoded: true,
        requestContext: { http: { method: 'POST' } },
      }),
    );
    expect(req.method).toBe('POST');
    expect(new URL(req.url).search).toBe('?a=1');
    expect(req.headers.get('origin')).toBe('https://app.example.com');
    expect(await req.text()).toBe('{"code":"ABC"}');
  });
});

describe('clientIp', () => {
  const req = (headers: Record<string, string>) => new Request('https://x.test/', { headers });

  it('prefers the Cloudflare header', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' }))).toBe('1.1.1.1');
  });

  it('never trusts an address the client put at the front of X-Forwarded-For', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.5' }))).toBe('203.0.113.5');
  });

  it('counts back from the end by the number of trusted proxies', () => {
    process.env['TRUSTED_PROXY_HOPS'] = '2';
    try {
      expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.5, 18.0.0.1' }))).toBe('203.0.113.5');
    } finally {
      delete process.env['TRUSTED_PROXY_HOPS'];
    }
  });
});
