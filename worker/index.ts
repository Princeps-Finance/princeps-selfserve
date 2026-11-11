// Cloudflare Worker: serves the API routes with the same handlers that used to run as Vercel Functions.
// Everything else (the Angular app) is served from static assets by the platform, see wrangler.jsonc.
import employmentTypes from '../api/employment-types';
import referral from '../api/referral';
import submitLoan from '../api/submit-loan';
import selfserve from '../api/selfserve/[op]';
import { fail } from '../api/_lib/http';

type Handler = (req: Request) => Promise<Response>;

const ROUTES: Record<string, Handler> = {
  '/api/employment-types': employmentTypes,
  '/api/referral': referral,
  '/api/submit-loan': submitLoan,
};

export default {
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    const exact = Object.hasOwn(ROUTES, pathname) ? ROUTES[pathname] : undefined;
    try {
      if (exact) return await exact(req);
      if (/^\/api\/selfserve\/[a-z0-9-]+$/.test(pathname)) return await selfserve(req);
    } catch (err) {
      console.error('unhandled api error', pathname, err instanceof Error ? err.message : 'unknown');
      return fail('SERVER_ERROR', 'Something went wrong. Try again shortly.', 500);
    }
    return fail('NOT_FOUND', 'Not found.', 404);
  },
};
