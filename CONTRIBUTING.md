# Contributing

## Branches
- `self-service-development`: where work lands. It uses the mock API and shows the "Demo" strip.
- `self-service-production`: the live site. It uses the real API and shows no demo strip. Release by pull request from development.
- `main`: left over from before. It is still the GitHub default, so keep it until that setting points at the branches above.

Branch from `self-service-development` and name the branch for the change: `fix/…`, `feat/…`, `refactor/…`, `docs/…`.

## Pull requests
- One change per pull request. If the title needs "and", split it.
- Aim for under about 300 changed lines. Moving files counts as one change.
- Say what changed and why in two or three plain sentences, then how you checked it.
- Merged branches are deleted.

## Code
- Reuse before writing: look in `src/app/shared` and `src/app/core/ui` for an existing component first. Put anything used in two places there.
- Styles use tokens from `src/styles/tokens.css` (colour, spacing, radius, type). No hex values and no fixed pixel sizes in components. Shared buttons, step headers and fields are in `src/styles.css`.
- Steps move with `FlowNavigator` and the names in `src/app/core/flow/apply-routes.ts`. A step that needs earlier answers gets a route guard in `src/app/core/flow/guards.ts`, not a redirect in the component.
- New text goes in `src/app/core/i18n/dictionaries`, in all four languages (English first; mark placeholders `TODO(translate)`).

## Checks before opening a pull request
```bash
npx ng test --watch=false
npx ng build
```

## Deployments
The app and its API run as one Cloudflare Worker (`wrangler.jsonc`, `worker/index.ts`) on the Princeps Cloudflare account
(product@princepsfinance.com). Deploys are manual for now:

```bash
npx wrangler whoami            # confirm the account first
npm run deploy                 # development: princeps-selfserve
npm run deploy:production      # production: princeps-selfserve-production
```

Settings the API needs are set with `npx wrangler secret put <NAME>` (never in the repo): `BACKOFFICE_API_URL`,
`SELFSERVE_INGEST_TOKEN`, `TURNSTILE_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REFERRAL_CODES`,
and `ALLOWED_ORIGINS` once there is a domain. GitHub Actions runs the tests and the build on every pull request.
