# Self service v2 integration

The development contract is [Princeps self service Swagger](https://self-service-apply.princeps.cloud/docs). The [pinned OpenAPI snapshot](self-service-v2.openapi.json) is the reviewed input to `npm run generate:api`. That generates one contract beside the application API client. Zod Mini validates response payloads at runtime and provides the TypeScript types. The generator includes the DTOs the frontend consumes. The generator corrects known Swagger cases where a nullable scalar was declared as an object. The pinned November 14 contract documents the response envelope. Transport validates successful payloads and reads error metadata from `data`. The LGA examples contain strings even though the generated OpenAPI schema references an empty `String` object. The client validates the string array. The document status parser accepts omitted DigiSign flags for compatibility with the published examples and older deployments. Refresh the snapshot deliberately, review the contract diff, and regenerate the client contract.

## Application and data boundaries

- `features/apply/data-access` contains the application operations. `core/session` contains the Angular interceptor that scopes the resume header to the current application and API origin. Envelope parsing and error handling live beside the API client. The browser sends bytes directly to the signed storage URL without the resume token.
- `features/apply/state` holds the application and offer state in NgRx Signal Stores. Forms belong to each routed screen and use Angular Reactive Forms and shared controls. Eligibility, pricing, workflow results, mandate status and submission come from the backend. OTP must succeed in the current tab session before protected screens open.
- `core/session` keeps the token and current verification in memory, cancels pending work on reset, and removes obsolete customer keys from browser storage. Refreshing or reopening the app requires BVN and OTP. After verification, the backend determines where to resume.
- The reference data store in `features/apply/data-access` caches only validated public responses and shares concurrent lookups. Banks expire after 24 hours, states and LGAs after 7 days, and employment categories, MDAs and employers after 15 minutes. Cache keys include schema version, environment, and backend origin. Language and theme remain browser preferences.
- `runtime-config.ts` validates public runtime values before bootstrapping. `APP_CONFIG` is Angular’s typed injection token for those values; ngx-env still loads the files and exposes the values.
- Theme, translation, PWA, privacy, accessibility and toast services remain app-wide. The old mock clients, local business rules, local loan book, customer draft persistence, pre-verification check and proxy handlers were retired. The contract has no anonymous eligibility, standalone NIN, loan book or waitlist operations.
- Mono OTP accepts an alternate phone only when the API returns that contact option. If the Mono session expires, the customer starts BVN verification again.
- DigiSign is an optional identity route. The browser opens the returned HTTPS signing page, polls identity status while the apply screen is active, and keeps the existing uploads available as a fallback. Cancellation closes a draft after explicit confirmation. Provider mandates listed in the response still need external revocation; the UI tells the customer to contact support. New journey copy without translations falls back to English.

Application requests use the browser’s no-store mode. The service worker caches app assets only and excludes runtime configuration. Response cache headers and CORS on the backend or upload bucket are controlled by those services.

## Build once and promote

`npm run build` produces one optimized browser artifact in `dist/princeps-selfserve/browser`. The production build deliberately contains unconfigured placeholders. The compiled JS reads ngx-env’s generated `/ngx-env.js` when it starts.

The CI workflow publishes the browser artifact and preparation files. Run **Promote browser artifact** with that CI run ID and an environment. Set `NG_APP_API_BASE_URL` and optional `NG_APP_ACCOUNTS_URL` as public variables for each GitHub environment. The staging and production API origins must be supplied by the deployment owner. The workflow prepares each environment from the same artifact, updating runtime settings and the hosting policy with the API origin. It deploys development to Cloudflare using its existing secret. Staging and production publish prepared artifacts for static hosting.

To prepare locally from a **copy** of the release artifact:

```bash
NG_APP_ENVIRONMENT=development \
NG_APP_API_BASE_URL=https://self-service-apply.princeps.cloud \
npm run config:runtime -- ./release/browser ./release/customHttp.yml
```

Serve the output with SPA route rewrites and `Cache-Control: no-store` for `/ngx-env.js`. For Amplify, switch the existing branch rebuild to artifact delivery and apply the prepared `customHttp.yml` as hosting headers. The CSP includes documented AWS S3 upload origins. If the backend uses a different signed upload origin, add that origin to the hosting policy.

Run `npm run test:ci` for contract, session, cache and shared control tests. The HTTP tests use fixtures and do not send customer data or create applications.
