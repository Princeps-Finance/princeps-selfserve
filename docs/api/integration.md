# Self service v2 integration

The development contract is [Princeps self service Swagger](https://self-service-apply.princeps.cloud/docs). The [pinned OpenAPI snapshot](self-service-v2.openapi.json) is the reviewed input to `npm run generate:api`. That generates one contract beside the application API client. Zod Mini validates response payloads at runtime and provides the TypeScript types. The generator includes the DTOs the frontend consumes. The generator corrects known Swagger cases where a nullable scalar was declared as an object. The pinned November 14 contract documents the response envelope. Transport validates successful payloads and reads error metadata from `data`. The LGA examples contain strings even though the generated OpenAPI schema references an empty `String` object. The client validates the string array. The document status parser accepts omitted DigiSign flags for compatibility with the published examples and older deployments. Refresh the snapshot deliberately, review the contract diff, and regenerate the client contract.

## Application and data boundaries

- `features/apply/data-access` contains the application operations. `core/session` contains the Angular interceptor that scopes the resume header to the current application and API origin. Envelope parsing and error handling live beside the API client. The browser sends bytes directly to the signed storage URL without the resume token.
- `features/apply/state` holds the application and offer state in NgRx Signal Stores. Forms belong to each routed screen and use Angular Reactive Forms and shared controls. Eligibility, pricing, workflow results, mandate status and submission come from the backend. OTP must succeed in the current tab session before protected screens open.
- `core/session` keeps the token and current verification in memory, cancels pending work on reset, and removes obsolete customer keys from browser storage. Refreshing or reopening the app requires BVN and OTP. After verification, the backend determines where to resume.
- The reference data store in `features/apply/data-access` caches only validated public responses and shares concurrent lookups. Banks expire after 24 hours, states and LGAs after 7 days, and employment categories, MDAs and employers after 15 minutes. Cache keys include the schema version and backend origin. Language and theme remain browser preferences.
- ngx-env reads public frontend environment variables during the build. The API client checks the configured origin when it makes a request.
- Theme, translation, PWA, privacy, accessibility and toast services remain app-wide. The old mock clients, local business rules, local loan book, customer draft persistence, pre-verification check and proxy handlers were retired. The contract has no anonymous eligibility, standalone NIN, loan book or waitlist operations.
- Mono OTP accepts an alternate phone only when the API returns that contact option. If the Mono session expires, the customer starts BVN verification again.
- DigiSign is an optional identity route. The browser opens the returned HTTPS signing page, polls identity status while the apply screen is active, and keeps the existing uploads available as a fallback. Cancellation closes a draft after explicit confirmation. Provider mandates listed in the response still need external revocation; the UI tells the customer to contact support. New journey copy without translations falls back to English.

Application requests use the browser’s no-store mode. The service worker caches app assets only and excludes runtime configuration. Response cache headers and CORS on the backend or upload bucket are controlled by those services.

## Build and deploy

Set `NG_APP_API_BASE_URL` and, optionally, `NG_APP_ACCOUNTS_URL` in the hosting build environment before running `npm run build`. ngx-env generates `ngx-env.js` in `dist/princeps-selfserve/browser` and the browser reads it on startup. Rebuild when the settings change. Use [the Amplify setup](../amplify.md) for Git-connected deployments.

The GitHub Actions **Build browser release** workflow builds the selected branch or tag with variables from the selected GitHub environment. It publishes the browser artifact and can deploy development to Cloudflare using its existing secret. Serve the output with SPA rewrites, `Cache-Control: no-store` for `/ngx-env.js`, and a content security policy that permits the configured API and signed upload hosts.

Run `npm run test:ci` for contract, session, cache and shared control tests. The HTTP tests use fixtures and do not send customer data or create applications.
