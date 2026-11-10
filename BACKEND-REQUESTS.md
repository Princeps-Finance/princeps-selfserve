# Backend requests for the self-service app

Written against the live OpenAPI spec at `https://self-service-api.princeps.cloud/docs-json` (v0.1.0).
Priority: **P0** blocks a screen or a safety guarantee, **P1** needed for parity with the current app, **P2** can follow.

## P0

### 1. List a customer's loans (blocks the "Your loans" screen)
No endpoint exists for existing loans, balances or repayments.
- Suggested: `GET /api/applications/{id}/loans` (resume token, only after OTP is verified and the Caltos customer is `FOUND`).
- Return for each loan: `id`, `reference`, `productName`, `status` (`active` | `overdue` | `completed`), `principal`, `outstanding`, `monthlyRepayment`, `nextDueDate`, `instalmentsPaid`, `instalmentsTotal`, `ratePercent`, `tenorMonths`, `disbursedAt`, `mandateStatus`.
- Money as numbers in a stated unit (naira or kobo), dates as ISO strings. Include paid-off loans.
- Also confirm which fields of `caltosCustomer` on the application are safe to show a returning customer (first name, employment type, employer, last loan date).

### 2. One source of truth for pricing
The app currently carries its own catalogue and repayment maths, which can drift from Caltos.
- Clarify on `GET /api/products`: the unit of `rate` (per month, per year, per tenor), `interestType`, `interestChargeFrequency`, how `processingFee` is expressed (percent or flat, one or several fees), amount step, and repayment frequency.
- Better: `POST /api/products/{id}/quote` with `{ amount, tenor }` returning `monthlyRepayment`, `totalRepayment`, `interest`, `fees[]`, `apr` and the repayment `schedule[]`. The app then displays exactly what Caltos will charge, and the "estimated yearly rate" becomes the real one.
- State whether fees are deducted from the amount received or added to repayments.

### 3. Safe retries on submit
`POST /api/applications/{id}/submit` returns 409 if already submitted. After a timeout the customer cannot tell whether the loan was created.
- Make a repeat submit for the same application return the existing loan (200) instead of 409, or accept an `Idempotency-Key` header.
- Guard against two concurrent applications for the same BVN.

### 4. Eligibility decided on the server
Scoring runs in the browser today, so it can be bypassed.
- Suggested: `POST /api/applications/{id}/eligibility` returning `decision` (`approved` | `review` | `declined`), `maxAmount`, `maxTenorMonths` and machine-readable reason codes (the app translates them).
- Submit should refuse an amount above that maximum.

### 5. Repayment mandate
The app has a mandate step (link or authorize, then status). Nothing in the spec covers it.
- Needed: create a mandate (returns a link or reference), `GET` its status (`pending` | `authorized` | `failed`), and how it ties to the application and submit.

### 6. Identity capture and documents
`documents/presign` exists, which is what the app needs for photo, video and documents.
- List the allowed `documentType` values per product (selfie, video, payslip, ID, and so on), accepted content types and size limits.
- Say how an upload is confirmed after the S3 PUT, and how a liveness or face-match result is returned.

## P1

### 7. Start, OTP and resend
The app asks for the BVN first and sends the code to the BVN-linked phone. `POST /api/applications` requires `email`, `bvn` and `phone`.
- Make `email` optional, and `phone` optional when it comes from the BVN record.
- Document when the OTP is sent, and add a resend endpoint with a cooldown and attempt limits.
- Return the BVN identity needed to prefill and check the profile (name, date of birth, address) and say what is deliberately withheld.

### 7a. Choose where the code goes (new in the BVN step)
After the customer enters a BVN, the app shows the phones and emails tied to it, partly hidden, and lets them pick where to get the code. If they can reach none of them they type another phone number.
- `POST bvn-contacts` `{ bvn, captchaToken }` returns `{ status, phones: [{ id, masked }], emails: [{ id, masked }] }`. Only masked values and opaque ids ever leave the server. Same bot check and per-BVN limits as the code send.
- The code send takes an optional destination: `{ kind: 'bvn-contact', id }` or `{ kind: 'alternate-phone', phone }`.
- **Security decision needed.** A code sent to a number the customer typed proves they hold that number, not that the BVN is theirs. Pick the extra check for the alternate-number path (for example matching name and date of birth against the BVN record, a lower first-loan limit, or manual review) and have the API flag the application so the status screen can say what happens next.
- **Privacy.** Showing masked contacts to anyone who types a BVN reveals that the BVN exists and a few digits. Keep the masking heavy (last two digits of a phone, first letter and domain of an email), rate limit per BVN and per IP, and never log the values.

### 8. Salary and employment checks
IPPIS, Remita and Dedukt checks exist. Document the exact request and response, including the verified monthly income, the error cases the app must show (not found, mismatch, service down), and the mapping from our employment types and channels.

### 9. Application status for the customer
A status read that returns the reference, state (received, under review, approved, declined, disbursed) and a human-readable reason, so the status screen can show more than "received".

### 10. Referral codes
There is no referral concept. Decide whether to support it:
- If yes: a validate call (`GET /api/referral-codes/{code}` returning the discount), a `referralCode` field on submit, and the discount applied by Caltos product rules so the quote matches.
- If no: the app removes the feature.

### 11. Private-sector statement review and waitlist
The app sends a bank statement review request and a waitlist signup for unsupported employment types. Neither is in the spec.

## P2

### 12. Operational
- A sandbox with test BVNs and OTPs.
- CORS policy, or confirmation that only our server calls the API. The spec lists no `servers`, and the only auth scheme is the per-application resume token, so say whether any other key is required.
- Resume token lifetime and what happens when it expires.
- Stable machine-readable error codes alongside the NestJS `statusCode` and `message`.
- Rate limits per route, and the personal data each response contains.

### 13. Product and policy decisions we need from the business
- The reminder schedule for repayments (how many days before and after the due date), so it can be shown to customers.
- Which loan states count as "overdue".

---

## Flow step by step: what exists and what is missing

Legend: **Yes** = an endpoint exists and fits; **Partly** = exists but needs the change noted; **Missing** = nothing in the spec.

| Step in our flow | What the app needs | Live API | Status |
|---|---|---|---|
| Language | nothing | none needed | n/a |
| Enter BVN, send code to the BVN-linked phone | verify the BVN, send an OTP, get the identity back (name, date of birth, address) | `POST /api/applications` needs `email`, `bvn`, `phone`; the identity returned is not documented | **Partly** (email must become optional; say when the OTP is sent) |
| Where the code goes | list masked contacts for a BVN; send to one, or to an alternate phone | none | **Missing** (see 7a) |
| Resend the code | resend with a cooldown | none | **Missing** |
| Verify the code | check the OTP, return a token | `POST /api/applications/{id}/otp/verify` (410 expired, 429 too many tries) | **Yes** |
| Returning customer check | know the customer exists and read a few safe fields | `caltosCustomerLookupStatus` (`FOUND`/`NOT_FOUND`/`CONFLICT`) and `caltosCustomer` | **Partly** (fields not documented) |
| Your loans (returning customers) | list loans, balances, next due date, mandate state | none | **Missing** |
| Profile | save name, date of birth, address, status | `PATCH /api/applications/{id}` with free-form `data` | **Yes** |
| States and local governments, countries | pick a state and LGA; submit needs `state_id` and `country_id` | none | **Missing** |
| Employment type | list the types | `GET /api/employment-types` | **Yes** |
| Salary check, government (IPPIS, Remita) and paramilitary (Dedukt) | verify employment and income | three `employment-verification` endpoints, plus the Dedukt employers list | **Yes** (request and response shapes to confirm) |
| Bank list and account name check | list banks, confirm the account name | none for the list; an account-name check appears only inside the journey | **Missing** (bank list), **Partly** (name check) |
| Private-sector statement review | send a bank statement for review | none | **Missing** |
| Waitlist for unsupported employment types | save an email or phone against a type | none | **Missing** |
| Eligibility | decision, maximum amount and tenor, reasons | the journey returns eligibility and affordability rules, but nothing evaluates them | **Missing** (server-side decision) |
| Offers and product choice | products with rate, limits, tenor, fees | `GET /api/products`, `GET /api/products/{id}/journey` | **Partly** (rate units, fee breakdown and amount step unclear; no quote) |
| Quote for an amount and tenor | monthly repayment, total, interest, fees, APR, schedule | none | **Missing** |
| Referral code | validate and apply a discount | none | **Missing** |
| Terms and consent | record the consent version and time | no field; could go in `PATCH` `data` | **Partly** (needs an agreed place) |
| NIN check (some products) | verify the NIN | may be a configured verification check | **Partly** (confirm which `checkKey`) |
| Documents | upload payslip and other proofs | `POST .../documents/presign`, `GET /api/files/...` | **Yes** (document types and size limits to confirm) |
| Selfie and spoken-amount video | upload and check liveness | presign covers the upload; no confirm or liveness result | **Partly** |
| Repayment mandate | create a link or authorise, then read its status | none | **Missing** |
| Submit | create the loan | `POST .../submit` (first and last name, address, state and country ids, bank, `loanProductId`, `tierId`, amount, duration) | **Yes** (our payload needs those fields; retries and idempotency are missing) |
| Status screen | reference, state, reason | `GET /api/applications/{id}` returns `status` and `caltosLoanResponse` | **Partly** (no readable reason) |
| Save and resume on another device | server-side draft | `GET` and `PATCH` application, resume token | **Yes** (this could replace the draft kept on the device) |

### A flow-order mismatch to settle
The API binds a product to the application early: verification checks and the journey come from the chosen product, and `verifications` returns 409 until a product snapshot exists. Our flow asks for the BVN first and lets the customer pick a product only at the offers step, after eligibility. Either the API needs a product-independent first stage (BVN and OTP), or the app has to ask for the product earlier.
