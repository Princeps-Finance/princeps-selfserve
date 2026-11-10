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
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared rate-limit store (Upstash Redis). **Required in production**: without them every limited call is refused, so the app cannot go live by accident without limits. Keys are hashed; no BVN, phone or token is stored. |
| `SMS_HOURLY_CAP` | Optional. Texts per hour across all customers (default 1000). Caps the SMS bill. |
| `TURNSTILE_SECRET` | Optional. When set, `send-otp` requires a valid Cloudflare Turnstile token. **Set before launch.** |

Client-side (`src/environments/*`): `turnstileSiteKey` (empty disables the bot check) and
`customerModuleUrl` (where "Track your loan" sends the customer).

If a required variable is missing the functions answer `503` (fail closed).

## Build modes

- `ng serve` (development): `useMockApi = true`, the whole wizard runs on an in-process mock.
- `ng build` (production): **demo period** (until Caltos is connected) the deployed app also runs on the mock
  (OTP `123456`) and shows a "Demo version. No real application is sent." strip. Switch both flags in
  `src/environments/environment.production.ts` (`useMockApi: false`, `demoBanner: false`) before real customers.
  With the mock off, nothing is faked: a failed call shows an error and a verification failure is never
  reported as success.

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
| `/api/selfserve/send-bvn-otp` | `{bvn}` | `{status:'sent', target, expiresInSeconds}` (masked phone **linked to the BVN**) / `{status:'not-found'}`. Sent by Princeps to the BVN's own phone, never to a number the customer typed. |
| `/api/selfserve/verify-bvn-otp` | `{bvn, code}` | `{status:'ok', token, identity:{fullName, dateOfBirth, state?, lga?, street?}}` / `{status:'wrong'\|'expired'}` / `{status:'locked', retryAfterSeconds}`. **Never return the BVN photo to the browser**; keep it server-side for face match against the selfie. Name and date of birth are shown read-only and become the application's identity. |
| `/api/selfserve/lgas` | `{state}` | `{lgas: string[]}` for that state. Empty list = the customer types the LGA. |
| `/api/selfserve/statement-review` | `{contact, bvn, employer, bankCode, fileName, sizeBytes}` (token required) | `{status:'received', referenceId}`. Private-sector applicants are not auto-scored: a person reviews the statement. The PDF upload itself still needs the real upload endpoint. |
| `/api/selfserve/lookup-contact` *(token required)* | `{phone, email}` | `{kind:'new'}` or `{kind:'returning', profileHint, snapshot}`. Called **after** OTP, so who is a customer is never revealed before the phone is verified |
| `/api/selfserve/banks` | `{}` | `{banks:[{code,name}]}` |
| `/api/selfserve/verify-salary` *(token)* | `{channel, bankCode, accountNumber, fullName, ippisNumber?, employer?}` | `{status:'ok', monthlyIncome, accountName}` / `{status:'name-mismatch'\|'not-found'\|'service-down'}`. The account name must match `fullName` |
| `/api/selfserve/verify-bvn` *(token)* | `{bvn, fullName, dateOfBirth}` | `{status:'ok'\|'name-mismatch'\|'not-found'\|'service-down'}` **and nothing else** |
| `/api/selfserve/verify-nin` *(token)* | `{nin, fullName, dateOfBirth}` | same shape as BVN |
| `/api/selfserve/upload-document` *(token)* | `{docId, fileName, sizeBytes}` | `{status:'ok'\|'too-large'\|'bad-type'\|'network'}` |
| `/api/selfserve/mandate-link` *(token)* | `{productId, channel, monthlyAmount, tenorMonths}` | `{url (https), reference}` |
| `/api/selfserve/mandate-status` *(token)* | `{reference}` | `{status:'pending'\|'completed'\|'failed'}` |
| `/api/selfserve/eligibility-check` *(no token: it runs before identity)* | `{employmentType, governmentLevel?, nyscMonthsRemaining?, channel, bankCode, accountNumber, ippisNumber?, employer?}` | `{status:'ok', decision:'approved'\|'review'\|'declined', maxAmount, tenorMonths}` / `{status:'not-found'\|'service-down'}`. Runs the **real employment and salary check** and the eligibility rules on the server. Our proxy passes on only `status`, `decision`, `maxAmount` and `tenorMonths`, so income and account name never reach the browser even if the back end sends them. Recommended: round `maxAmount` down (for example to ₦10,000), because this runs before identity and a precise maximum hints at someone's pay. Our proxy bot-checks it and allows 4 checks per account per hour. |
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
11. **Rate limits that hold across instances.** Done in the proxy with Upstash (see the env table). Caltos must still lock a
    code after repeated wrong guesses per BVN and phone, because that is the last line of defence.

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

## Sign-in order (changed)

Contact (phone, email, privacy consent) → **BVN** → OTP sent to the phone linked to the BVN → details released
and pre-filled. The typed phone number is a contact number only and is not texted. `send-otp` / `verify-otp`
(phone) remain in the API but the app no longer calls them. Customer lookup (resume / returning customer) runs after
the BVN OTP, as it did after the phone OTP.

## Sign-in order (revised)

The phone-and-email screen is gone. Order: welcome -> **BVN + privacy consent** -> OTP sent to the phone linked to the BVN
-> profile (address, state, LGA, relationship, optional email).

`verify-bvn-otp` must return, in `identity`: `firstName`, `fullName`, `dateOfBirth` (YYYY-MM-DD), `phone` (the BVN's
registered number, which becomes the contact number) and optionally `gender`. Address, state and LGA are **not** taken from
the BVN: the customer enters them. The app shows only the first name (a greeting); the rest of the record is never displayed.
`email` is optional on `lookup-contact`, `statement-review` and `waitlist`; the app leaves it out when empty.
