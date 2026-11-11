# Production on AWS Amplify

Development runs on Cloudflare (a Worker). **Production runs on AWS**: the Angular app on Amplify Hosting, and the API as
one Lambda behind an HTTP API. Amplify forwards `/api/*` to that API, so the browser still talks to one address.

```
browser -> Amplify Hosting (CloudFront) -> app files
                                        -> /api/*  ->  API Gateway (HTTP API) -> Lambda (aws/handler.ts)
```

The Lambda runs the same handlers as the development Worker (`api/router.ts`), so there is one API to maintain.

## What is in the repo

| File | What it does |
| --- | --- |
| `amplify.yml` | How Amplify builds the app. |
| `customHttp.yml` | The security and cache headers (same set as `public/_headers`). |
| `aws/template.yaml` | The API: Lambda, HTTP API, throttling. Deployed with AWS SAM. |
| `aws/handler.ts` | Turns an API Gateway event into a `Request`, runs the router, returns the response. |

## One-time setup (needs an AWS account and credentials; I cannot create these)

Pick one region for everything. If customer data location matters, decide that first (for example `af-south-1`).

1. **Secrets.** In AWS Secrets Manager create a secret named `princeps/selfserve-prod` of type "other", with these keys:
   `BACKOFFICE_API_URL`, `SELFSERVE_INGEST_TOKEN`, `TURNSTILE_SECRET`, `UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`, `REFERRAL_CODES`. Type the values in the console, never in chat or in the repo.
2. **Deploy the API.** With the AWS CLI and SAM CLI installed and signed in:
   ```bash
   sam build -t aws/template.yaml
   sam deploy --guided --parameter-overrides AllowedOrigins=https://YOUR-PRODUCTION-DOMAIN
   ```
   Note the `ApiUrl` it prints.
3. **Amplify app.** In the Amplify console: Host web app, connect the GitHub repo, branch `self-service-production`.
   Amplify finds `amplify.yml` and `customHttp.yml` on its own.
4. **Rewrites.** In Amplify, Hosting, Rewrites and redirects, add these in this order (type "Rewrite (200)"):
   1. `/api/<*>` to `<ApiUrl>/api/<*>`
   2. `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|webmanifest)$)([^.]+$)/>` to `/index.html`
      (the app shell, so deep links such as `/apply/bvn` work)
5. **Domain.** Add the production domain in Amplify (it issues the certificate). Then make sure `AllowedOrigins` in step 2
   is that exact address, and redeploy the API if it changed.
6. **Turn on the firewall.** Attach AWS WAF to the Amplify app with the rate-based and managed rules. This is the
   production abuse control on top of the app's own rate limits.

## Check after the first deploy

- `curl https://YOUR-DOMAIN/api/employment-types` returns the real list.
- **Client address.** Rate limits use the caller's address. The Lambda counts back from the end of `X-Forwarded-For` by
  `TRUSTED_PROXY_HOPS` (set to 2 in the template: CloudFront, then API Gateway). Send a request with a fake
  `X-Forwarded-For: 6.6.6.6` header and confirm the logged address is yours, not `6.6.6.6`. If it is wrong, change the number.
- The go-live gate (`npm run check:live`) still runs on every pull request into `self-service-production`.

## Cost and safety notes

- API Gateway is throttled in the template (25 requests a second, burst 50) so a flood cannot run up the bill.
- The secrets are read at deploy time and appear in the function's settings for anyone allowed to view the Lambda.
  Keep that permission narrow. A later step can read them at run time instead.
