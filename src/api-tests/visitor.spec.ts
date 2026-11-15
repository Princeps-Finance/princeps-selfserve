import { describe, expect, it } from 'vitest';
import { toRequest } from '../../aws/handler';
import { stripGeoHeaders, visitorHeader, visitorInfo } from '../../api/_lib/visitor';
import { withGeo } from '../../worker/index';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const req = (headers: Record<string, string>) => new Request('https://x.test/api/y', { headers });

describe('visitorInfo', () => {
  it('reads the device from the user agent', () => {
    expect(visitorInfo(req({ 'user-agent': IPHONE }))).toMatchObject({ deviceType: 'mobile', os: 'iOS', browser: 'Safari' });
    expect(visitorInfo(req({ 'user-agent': ANDROID }))).toMatchObject({ deviceType: 'mobile', os: 'Android', browser: 'Chrome' });
    expect(visitorInfo(req({ 'user-agent': WINDOWS }))).toMatchObject({ deviceType: 'desktop', os: 'Windows', browser: 'Edge' });
    expect(visitorInfo(req({ 'user-agent': IPAD }))).toMatchObject({ deviceType: 'tablet', os: 'iOS' });
  });

  it('says unknown when there is no user agent', () => {
    expect(visitorInfo(req({})).deviceType).toBe('unknown');
  });

  it('reads the place from the headers our edge adds, and rounds the coordinates to about a kilometre', () => {
    const info = visitorInfo(
      req({ 'user-agent': ANDROID, 'x-forwarded-for': '102.89.1.2', 'x-geo-country': 'NG', 'x-geo-region': 'Lagos', 'x-geo-city': encodeURIComponent('Ikeja'), 'x-geo-latitude': '6.60183', 'x-geo-longitude': '3.35146', 'x-geo-timezone': 'Africa/Lagos' }),
    );
    expect(info).toMatchObject({ ip: '102.89.1.2', country: 'NG', region: 'Lagos', city: 'Ikeja', latitude: 6.6, longitude: 3.35, timezone: 'Africa/Lagos' });
  });

  it('falls back to the CloudFront headers in production', () => {
    const info = visitorInfo(req({ 'cloudfront-viewer-country': 'NG', 'cloudfront-viewer-city': 'Abuja', 'cloudfront-is-mobile-viewer': 'true' }));
    expect(info).toMatchObject({ country: 'NG', city: 'Abuja', deviceType: 'mobile' });
  });

  it('leaves out anything that is missing or not believable', () => {
    const info = visitorInfo(req({ 'x-geo-country': 'XX', 'x-geo-latitude': '999', 'x-geo-longitude': '3' }));
    expect(info.country).toBeUndefined();
    expect(info.latitude).toBeUndefined();
    expect(info.longitude).toBeUndefined();
  });

  it('is safe to send as a header whatever the city is called', () => {
    const header = visitorHeader({ deviceType: 'mobile', city: 'Ìkẹjà' });
    expect(header).toMatch(/^[\x20-\x7e]+$/);
    expect(JSON.parse(decodeURIComponent(header))).toEqual({ deviceType: 'mobile', city: 'Ìkẹjà' });
  });
});

describe('place headers cannot be forged', () => {
  it('strips them from a caller', () => {
    const h = new Headers({ 'x-geo-country': 'US', 'x-geo-city': 'Nowhere', accept: '*/*' });
    stripGeoHeaders(h);
    expect(h.get('x-geo-country')).toBeNull();
    expect(h.get('accept')).toBe('*/*');
  });

  it('drops a forged place on the Lambda path', () => {
    const r = toRequest({ rawPath: '/api/x', headers: { host: 'a.test', 'x-geo-country': 'US' }, requestContext: { http: { method: 'GET' } } });
    expect(r.headers.get('x-geo-country')).toBeNull();
  });

  it('on the worker, replaces a forged place with Cloudflare\'s own', () => {
    const base = new Request('https://a.test/api/x', { headers: { 'x-geo-country': 'US', 'x-geo-city': 'Forged' } });
    Object.defineProperty(base, 'cf', { value: { country: 'NG', city: 'Lagos' } });
    const out = withGeo(base);
    expect(out.headers.get('x-geo-country')).toBe('NG');
    expect(decodeURIComponent(out.headers.get('x-geo-city') ?? '')).toBe('Lagos');
  });
});
