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
- **Development** runs as a Cloudflare Worker (`wrangler.jsonc`, `worker/index.ts`) on the Princeps Cloudflare account
  (product@princepsfinance.com). A push to `self-service-development` deploys it (`.github/workflows/deploy.yml`, after the
  tests; pushes that only change docs, `design/` or `.claude/` are skipped). Manual deploy: `npx wrangler whoami`, then
  `npm run deploy`.
- **Production** runs on AWS Amplify (the app) and a Lambda (the API). See `docs/amplify.md`. It builds from
  `self-service-production`, and the go-live gate (`npm run check:live`) runs on every pull request into that branch.

Settings the development API needs are set with `npx wrangler secret put <NAME>` (never in the repo). Production secrets
live in AWS Secrets Manager.
