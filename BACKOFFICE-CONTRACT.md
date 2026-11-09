# Self-serve ↔ backoffice contract

The browser never talks to the backoffice. It calls two Vercel functions in
this repo, which validate, rate-limit and forward with a server-held token.

| Env var (Vercel, server-side only) | Purpose |
| --- | --- |
| `BACKOFFICE_API_URL` | Base URL of princeps-backoffice. **Required** (no default). |
| `SELFSERVE_INGEST_TOKEN` | Bearer token sent to the backoffice. **Required.** |
| `ALLOWED_ORIGINS` | Optional comma-separated origins allowed to call `/api/*`. Defaults to same-origin. |

If either required variable is missing the functions answer `503` (fail closed).

## Build modes

- `ng serve` / development: `environment.useMockApi = true` — the whole wizard runs on the in-process mock.
- `ng build` (production): `useMockApi = false` — `HttpApiClient` is used and nothing is faked. A failed call
  shows an error; verification failures are never reported as success.

## Application token

`verify-otp` must return an opaque `token` when the code is correct. The client keeps it in memory and sends it
as `X-Application-Token` on every later call, including `/api/submit-loan`. **The backoffice must refuse a loan
whose token is missing, expired, or not bound to the verified phone and BVN.** This is the only server-side proof
that OTP/BVN/NIN were actually completed; the browser is untrusted.

## Endpoints the backoffice must implement

All are `POST` with JSON, authenticated by `Authorization: Bearer <SELFSERVE_INGEST_TOKEN>`, and return `200`
with the JSON shown. Any non-2xx is shown to the user as "service unavailable". The proxy only forwards the
listed response keys.

| Path | Body | Response |
| --- | --- | --- |
| `/api/selfserve/lookup-contact` | `{phone, email}` | `{kind:'new'}` or `{kind:'returning', profileHint, snapshot}` |
| `/api/selfserve/send-otp` | `{phone}` | `{target, expiresInSeconds}` (masked target) |
| `/api/selfserve/verify-otp` | `{phone, code}` | `{status:'ok', token}` / `{status:'wrong'|'expired'}` / `{status:'locked', retryAfterSeconds}` |
| `/api/selfserve/banks` | `{}` | `{banks:[{code,name}]}` |
| `/api/selfserve/verify-salary` | `{channel, bankCode, accountNumber, ippisNumber?, employer?}` | `{status:'ok', monthlyIncome, accountName}` / `{status:'name-mismatch'|'not-found'|'service-down'}` |
| `/api/selfserve/verify-bvn` | `{bvn, fullName?}` | `{status:'ok', matchedName, dateOfBirth?, phone?, address?}` / `{status:'name-mismatch', matchedName}` / `{status:'not-found'|'service-down'}` |
| `/api/selfserve/verify-nin` | `{nin, fullName?}` | same shape as BVN |
| `/api/selfserve/upload-document` | `{docId, fileName, sizeBytes}` | `{status:'ok'|'too-large'|'bad-type'|'network'}` |
| `/api/selfserve/waitlist` | `{phone, email, type, employer?, incomeBand?, channel}` | `{status:'ok', referenceId, positionInQueue, estimatedWindow}` |
| `/api/loans` (from `/api/submit-loan`) | validated loan record (+ `feesKobo`) | `201 {id}` |

Enforce OTP attempt limits and lock-out in the backoffice; the proxy limits are only a first line of defence.

## What `/api/submit-loan` guarantees

- Same-origin only, body ≤ 8 kB, strict schema (unknown fields rejected), 5 submissions per IP per 10 minutes.
- `productId`, `channel` and `employmentType` must match the catalogue in `src/shared/pricing.ts`.
- Amount must be within the product range and tenor within 3–12 months.
- The client's `monthlyRepaymentKobo`, `ratePercent` and `interestModel` are **checked against a server recompute and
  rejected (409) if they differ**; the recomputed values are what get forwarded.
- Backoffice errors are never echoed to the browser.

## Still needed outside this repo

- **Eligibility ceiling:** `maxEligibleAmount` is computed in the browser from verified income. The backoffice must
  re-score from its own verified data before approving.
- **Rate limits that hold across instances:** the in-function limiter is per serverless instance. Add Vercel Firewall
  rate-limit rules on `/api/selfserve/*` and `/api/submit-loan` (or Upstash) for a hard guarantee.
- **Document and face/video upload:** the app sends file *metadata* only and keeps the captured photo/video in memory
  (cleared on successful submit). A storage destination and signed-upload flow must be chosen before real documents or
  biometrics are collected.
