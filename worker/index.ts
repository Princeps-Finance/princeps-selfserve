// Cloudflare Worker (development): serves the API routes. Everything else (the Angular app) is served from static
// assets by the platform, see wrangler.jsonc. Production runs the same routes as an AWS Lambda, see aws/handler.ts.
import { route } from '../api/router';

export default {
  fetch: (req: Request): Promise<Response> => route(req),
};
