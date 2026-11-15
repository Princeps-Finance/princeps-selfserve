import { clientIp } from './http';

/**
 * What the server can tell about who is calling, for the back-office admin: the device and the place the connection
 * comes from. It is read from the request itself, never from anything the browser sends in the body, so the customer
 * cannot change it. The place is the connection's, not a GPS fix: it is the city the network suggests, and a mobile
 * network or a VPN can put it somewhere else.
 */
export interface VisitorInfo {
  ip?: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  os?: string;
  browser?: string;
}

/**
 * Headers that carry the place, set by our own edge layer (the Cloudflare worker copies `request.cf` into them).
 * A browser must never be able to set them, so every entry point removes any it receives, see `stripGeoHeaders`.
 */
export const GEO_HEADERS = ['x-geo-country', 'x-geo-region', 'x-geo-city', 'x-geo-latitude', 'x-geo-longitude', 'x-geo-timezone'] as const;

/** Removes place headers a caller sent, so only the ones our edge adds are trusted. Used by every entry point. */
export function stripGeoHeaders(headers: Headers): void {
  for (const name of GEO_HEADERS) headers.delete(name);
}

function clean(v: string | null | undefined, max = 60): string | undefined {
  if (!v) return undefined;
  let s = v.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    // keep the text as it came
  }
  s = s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  return s || undefined;
}

/** About a kilometre: enough to see the area, not the street. */
function coordinate(v: string | null | undefined, limit: number): number | undefined {
  const n = Number(v);
  return v && Number.isFinite(n) && Math.abs(n) <= limit ? Math.round(n * 100) / 100 : undefined;
}

function osOf(ua: string, platformHint: string | undefined): string | undefined {
  if (platformHint) return clean(platformHint.replace(/"/g, ''), 30);
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return undefined;
}

function browserOf(ua: string): string | undefined {
  if (/EdgA?\/|Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS/i.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS/i.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return undefined;
}

function deviceOf(req: Request, ua: string): VisitorInfo['deviceType'] {
  const h = req.headers;
  if (h.get('cloudfront-is-tablet-viewer') === 'true') return 'tablet';
  if (h.get('cloudfront-is-mobile-viewer') === 'true') return 'mobile';
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
  if (h.get('sec-ch-ua-mobile') === '?1' || /Mobi|iPhone|iPod|Android/i.test(ua)) return 'mobile';
  if (h.get('cloudfront-is-desktop-viewer') === 'true') return 'desktop';
  return ua ? 'desktop' : 'unknown';
}

/** The caller's device and connection place, as far as this request tells. Anything unknown is simply left out. */
export function visitorInfo(req: Request): VisitorInfo {
  const h = req.headers;
  const ua = h.get('user-agent') ?? '';
  const country = clean(h.get('x-geo-country') ?? h.get('cloudfront-viewer-country') ?? h.get('cf-ipcountry'), 2)?.toUpperCase();
  const ip = clientIp(req);
  const info: VisitorInfo = {
    deviceType: deviceOf(req, ua),
    ...(ip && ip !== 'unknown' ? { ip: ip.slice(0, 64) } : {}),
    ...(country && /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? { country } : {}),
  };
  const region = clean(h.get('x-geo-region') ?? h.get('cloudfront-viewer-country-region-name'));
  const city = clean(h.get('x-geo-city') ?? h.get('cloudfront-viewer-city'));
  const lat = coordinate(h.get('x-geo-latitude') ?? h.get('cloudfront-viewer-latitude'), 90);
  const lon = coordinate(h.get('x-geo-longitude') ?? h.get('cloudfront-viewer-longitude'), 180);
  const timezone = clean(h.get('x-geo-timezone') ?? h.get('cloudfront-viewer-time-zone'), 40);
  const os = osOf(ua, h.get('sec-ch-ua-platform') ?? undefined);
  const browser = browserOf(ua);
  if (region) info.region = region;
  if (city) info.city = city;
  if (lat !== undefined && lon !== undefined) {
    info.latitude = lat;
    info.longitude = lon;
  }
  if (timezone) info.timezone = timezone;
  if (os) info.os = os;
  if (browser) info.browser = browser;
  return info;
}

/** The value of the `X-Visitor-Info` header sent to the back office: JSON, percent-encoded so any city name is safe. */
export function visitorHeader(info: VisitorInfo): string {
  return encodeURIComponent(JSON.stringify(info));
}
