// Cloudflare Worker (development): serves the API routes. Everything else (the Angular app) is served from static
// assets by the platform, see wrangler.jsonc. Production runs the same routes as an AWS Lambda, see aws/handler.ts.
import { route } from '../api/router';
import { stripGeoHeaders } from '../api/_lib/visitor';

/** Cloudflare's own idea of where the connection comes from (`request.cf`), not trusted from the browser. */
interface CfGeo {
  country?: string;
  region?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
}

/** Copies the connection's place into headers only this worker sets. Anything a caller sent under those names is removed first. */
export function withGeo(req: Request): Request {
  const headers = new Headers(req.headers);
  stripGeoHeaders(headers);
  const cf = (req as Request & { cf?: CfGeo }).cf;
  const set = (name: string, v: string | undefined): void => {
    if (v) headers.set(name, encodeURIComponent(v));
  };
  set('x-geo-country', cf?.country);
  set('x-geo-region', cf?.region);
  set('x-geo-city', cf?.city);
  set('x-geo-latitude', cf?.latitude);
  set('x-geo-longitude', cf?.longitude);
  set('x-geo-timezone', cf?.timezone);
  return new Request(req, { headers });
}

export default {
  fetch: (req: Request): Promise<Response> => route(withGeo(req)),
};
