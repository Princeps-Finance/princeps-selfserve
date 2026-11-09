# Self-serve ↔ Caltos contract

The browser never talks to Caltos. It calls two Vercel functions in this repo, which validate,
rate-limit and forward with a server-held token. (Earlier drafts called the target a
"backoffice"; there is none. Rename the env vars when convenient; the names below are what the
code reads today.)

| Env var (Vercel, server-side only) | Purpose |
| --- | --- |
| `BACKOFFICE_API_URL` | Base URL of the Caltos API. **Required** (no default). |
| `SELFSERVE_INGEST_TOKEN` | Bearer token sent to Caltos. **Required.** |
| `ALLOWED_ORIGINS` | Optional comma-separated origins allowed to call `/api/*`. Defaults to same-origin. |
| `TURNSTILE_SECRET` | Optional. When set, `send-otp` requires a valid Cloudflare Turnstile token. **Set before launch.** |

Client-side (`src/environments/*`): `turnstileSiteKey` (empty disables the bot check) and
`customerModuleUrl` (where "Track your loan" sends the customer).

If a required variable is missing the functions answer `503` (fail closed).

## Build modes

- `ng serve` (development): `useMockApi = true`, the whole wizard runs on an in-process mock.
- `ng build` (production): `useMockApi = false`. Nothing is faked: a failed call shows an error and a
  verification failure is never reported as success.

## The journey the API supports

Language → intent (apply now / see how much I can get) → contact + consent → OTP → bio data → work details →
**eligibility → offers (customer edits amount and tenor)** → terms → **loan documentation** (BVN, NIN only if the
product needs it, documents, selfie holding ID + video, mandate) → submit.

Caltos receives the application **only at submission**. Drafts live on the customer's device, up to the salary
step (bio data and work details). BVN, NIN, documents, photo and video are never saved on the device.

## Application token

`verify-otp` must return an opaque `token` when the code is correct. The client keeps it in memory and sends
it as `X-Application-Token` on every later call. The proxy **rejects with 401** any call other than
`send-otp`, `verify-otp` and `banks` that has no token, so nothing can be probed anonymously.
**Caltos must refuse a loan whose token is missing, expired, or not bound to the verified phone.**

## Endpoints Caltos must implement

All are `POST` with JSON, authenticated by `Authorization: Bearer <SELFSERVE_INGEST_TOKEN>`, and return `200` with
the JSON shown. Any non-2xx is shown to the user as "service unavailable". The proxy forwards only the listed
response keys.

| Path | Body | Response |
| --- | --- | --- |
| `/api/selfserve/send-otp` | `{phone}` | `{target, expiresInSeconds}` (masked target) |
| `/api/selfserve/verify-otp` | `{phone, code}` | `{status:'ok', token}` / `{status:'wrong'\|'expired'}` / `{status:'locked', retryAfterSeconds}` |
| `/api/selfserve/lookup-contact` *(token required)* | `{phone, email}` | `{kind:'new'}` or `{kind:'returning', profileHint, snapshot}`. Called **after** OTP, so who is a customer is never revealed before the phone is verified |
| `/api/selfserve/banks` | `{}` | `{banks:[{code,name}]}` |
| `/api/selfserve/verify-salary` *(token)* | `{channel, bankCode, accountNumber, fullName, ippisNumber?, employer?}` | `{status:'ok', monthlyIncome, accountName}` / `{status:'name-mismatch'\|'not-found'\|'service-down'}`. The account name must match `fullName` |
| `/api/selfserve/verify-bvn` *(token)* | `{bvn, fullName, dateOfBirth}` | `{status:'ok'\|'name-mismatch'\|'not-found'\|'service-down'}` **and nothing else** |
| `/api/selfserve/verify-nin` *(token)* | `{nin, fullName, dateOfBirth}` | same shape as BVN |
| `/api/selfserve/upload-document` *(token)* | `{docId, fileName, sizeBytes}` | `{status:'ok'\|'too-large'\|'bad-type'\|'network'}` |
| `/api/selfserve/mandate-link` *(token)* | `{productId, channel, monthlyAmount, tenorMonths}` | `{url (https), reference}` |
| `/api/selfserve/mandate-status` *(token)* | `{reference}` | `{status:'pending'\|'completed'\|'failed'}` |
| `/api/selfserve/waitlist` *(token)* | `{phone, email, type, employer?, incomeBand?, channel}` | `{status:'ok', referenceId}` (`positionInQueue` and `estimatedWindow` only if real) |
| `/api/loans` (from `/api/submit-loan`) | validated loan record, see below | `201 {id}` |

### Identity checks must not be an oracle

`verify-bvn` and `verify-nin` take a claimed name **and** date of birth and answer match or no match. They must never
return the record holder's name, date of birth, phone or address, including on a mismatch. Otherwise anyone with a
BVN could look a stranger up. The proxy strips everything except `status`.

### Submission record

`/api/submit-loan` forwards: borrower name, BVN, phone, amount (kobo), tenor, monthly repayment, interest model and
rate, channel, bank code, account number, IPPIS number, employment type, employer, `feesKobo`, `appVersion`,
`consentVersion`, `consentAt`, `manualReview` (hint only), `mandateReference`. Money fields are recomputed from the
shared catalogue (`src/shared/pricing.ts`) and a mismatch is rejected (409).

## Fraud controls Caltos or partners must enforce (not possible in this repo)

These come from thinking like someone using stolen details. The browser cannot enforce them.

1. **The applicant is the BVN/NIN holder.** Name and date of birth are checked, but a phone match is not possible
   (customers may no longer have the BVN phone). Add **face match** (selfie holding ID and the BVN/NIN photo) with
   **liveness**, and human review of mismatches.
2. **Disburse only to the verified salary account** whose name matches the BVN name, and never allow changing it.
3. **The mandate is completed by the account holder** through their bank or payroll provider, never by a link the
   applicant forwards to someone else.
4. **Notify the contact on file** (not only the number typed in) of every new application; consider a short
   cooling-off before disbursement.
5. **Verify self-declared fields**: NYSC months remaining, employment type, and gender where a product depends on it.
6. **Re-score eligibility** server-side. The browser's `maxEligibleAmount` is a convenience only.
7. **Velocity and device checks** per BVN, phone, account number and device.
8. **Document verification** (authenticity, name match to BVN).
9. **Step-up for returning customers** (SIM-swap check, date of birth) before showing saved details.
10. **Active mandate and salary history before disbursement**, to limit default fraud.
11. **Rate limits that hold across instances** (Vercel Firewall or Upstash). The in-function limiter is per
    serverless instance only.

## What `/api/submit-loan` guarantees

- Same-origin only, body ≤ 8 kB, strict schema (unknown fields rejected), 5 submissions per IP per 10 minutes.
- `productId`, `channel` and `employmentType` match the catalogue; amount and tenor are within the product's limits.
- The client's repayment, rate and interest model are **checked against a server recompute and rejected if they
  differ**; the recomputed values are what get forwarded.
- Consent version and time are present and well formed. Caltos errors are never echoed to the browser.

## Still needed outside this repo

- Product settings (mandate mode, identity video mode, NIN requirement, documents, amount and tenor limits) come from
  the catalogue in `src/shared/pricing.ts` today. They should come from Caltos.
- **Document and face/video upload:** the app sends file *metadata* only and keeps the photo and video in memory
  (cleared on submit). A storage destination and signed-upload flow must be chosen before real documents or
  biometrics are collected. Vercel functions cap request bodies at about 4.5 MB, so uploads must go direct to storage.
- **USSD channel (planned):** it should call the same Caltos eligibility and product services, which is another
  reason eligibility must live in Caltos rather than the browser.
