// Maps an API path to its handler. Shared by every host (the Cloudflare Worker and the AWS Lambda), so a route is
// added once.
import employmentTypes from './employment-types';
import quote from './quote';
import referral from './referral';
import submitLoan from './submit-loan';
import selfserve from './selfserve/[op]';
import { fail } from './_lib/http';

type Handler = (req: Request) => Promise<Response>;

const ROUTES: Record<string, Handler> = {
  '/api/employment-types': employmentTypes,
  '/api/quote': quote,
  '/api/referral': referral,
  '/api/submit-loan': submitLoan,
};

export async function route(req: Request): Promise<Response> {
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
}
