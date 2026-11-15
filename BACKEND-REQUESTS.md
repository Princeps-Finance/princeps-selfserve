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

### 3. Safe retries on submit and other creating calls
The app now sends an `Idempotency-Key` (a UUID, the same on every retry of one action) with the loan submit, mandate creation, statement review and waitlist signup. The back office must store the key with the result and return the same result for a repeat, for at least 24 hours.

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

### 5a. The offer letter (PDF)
The terms step now shows the customer's offer letter in a PDF viewer. Needed: an endpoint that returns the PDF for the offer the customer is about to accept (for example `GET /api/applications/{id}/offer/document`), as `application/pdf`, under 5 MB, with the same amount, tenor, rate, fees and total as the offer. Our server wraps it as `{ pdfBase64 }` and refuses anything that does not start with `%PDF-`. Until it exists, the demo build shows a sample letter.

### 6. Identity capture and documents
*Update: face matching will be done by the back end, so the app does not need a liveness endpoint. It only needs the upload and a way to read the match result.*

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

### 8a. State government: states and employers (new screen)
State government staff now pick their state, and for some states an employer, before the salary details. The app already ships a default list, so this is configuration, not a blocker.
- `GET /api/state-employers` returns `{ states: [{ code, name, channel, employers: [{ code, name, channel }] }] }`. `channel` is `remita`, `ippis` or `dedukt` and says how repayments are collected. An employer without a `channel` inherits its state's.
- Today's default: Adamawa (SUBEB, LGA, PHCDA), Cross River, Delta, Gombe, Katsina, Ondo, Plateau. **PHCDA is `dedukt`. SUBEB and LGA are assumed `remita`: please confirm.**
- Add or remove a state or employer here and the app follows without a release. The app falls back to its own list when this cannot be reached.
- For an employer on `dedukt`, the app sends the employer's name in `employer` on the salary check, in place of the paramilitary employer list. Please confirm the names the salary check expects.

### 8b. Payslip scan
The salary screen offers an optional "scan your payslip".
- `POST /api/selfserve/payslip-extract`, multipart with `file` (JPEG, PNG, WebP, HEIC or PDF, up to 10 MB) and `captchaToken`. Answers `{ status: 'ok', figures: { netMonthly, grossMonthly?, month?, employer? } }` (naira, `month` as `YYYY-MM`). Use `413` for too large, `415` for a type not accepted, `429` for the limit, and `{ status: 'unreadable' }` when nothing usable was read.
- Run the reader on the server, so the payslip is not handled by a browser library. Say how long the file is kept. A payslip holds salary and employer details, so it needs the same care as the other documents.
- The customer confirms or corrects the figures, then the app sends them as `declaredNetPay` on `eligibility-check` and `verify-salary`. **Treat it as evidence, never as the verified pay**: eligibility stays decided on the server.

**Who is asked for a payslip.** `POST /api/selfserve/salary-requirements` with `{ employmentType, channel, governmentLevel?, stateCode?, employerCode? }` answers `{ payslip: true | false }`. The screen asks it when it opens and again whenever the pay channel changes, and shows the upload only on `true`. Remita alone does not mean a payslip: the decision is yours, per product, state or employer. An error or no answer means no upload, so the app never blocks a customer on this.

### 8c. Bank list and logos
`banks` should return the current licensed list (including OPay, Kuda, PalmPay and the other digital banks) with each bank's real NIBSS code, and an optional `logo`: a path on our own site such as `/banks/044.svg`. Our security policy only allows images from our own site, so serve the logo files from there. A bank with no logo shows its initials.

### 8d. Automation: what each piece needs from the back end
The app does the **photo quality check** itself (blurry, too dark, too small), so customers retake a bad photo before it is sent. Everything else below needs the back end. None of it should decline anyone on its own: a reader's result is evidence for a decision, and a person reviews any decline or doubt.

**Rules for all of them**
- Run readers on the server. Never trust the browser's quality check: repeat it and return `unreadable` per file.
- Say how long each file and each extracted value is kept, and who can see them. Payslips, IDs and selfies are personal data under the NDPA, so the privacy notice and consent text must name them.
- Log the outcome and a score, never the document's contents or numbers.
- Slow readers answer in the background: return a job id, and let the app poll or receive a result. The app waits up to 30 seconds today.
- Every result carries a `confidence` (0 to 1) and the reader's version, so thresholds can be tuned and audited.
- Rate limit per customer and per address, and answer `429` like the other routes.

| # | Automation | Endpoint (proposed) | The app sends | The back end returns | Notes for the back end |
|---|---|---|---|---|---|
| 1 | Payslip reading (the upload is offered only when `salary-requirements` says so) | `POST /api/selfserve/payslip-extract` (see 8b) | the file, `captchaToken` | `netMonthly`, `grossMonthly?`, `month?`, `employer?` | A vision model on the server is the likeliest fit. Reject payslips older than the allowed age. |
| 2 | ID reading | `POST /api/selfserve/id-extract`, or run when an ID document is uploaded | the ID image | `fullName`, `dateOfBirth`, `idNumber`, `expiry`, `idType`, `confidence`, and `match` against the BVN record | Return only the match result to the browser, not the whole BVN record. |
| 3 | Selfie match and liveness | `POST /api/selfserve/identity-check` | the stored photo and video keys | `decision: pass \| retry \| review`, `faceMatch` score, `liveness: pass \| fail` | Needs a face-match provider (the BVN photo or the ID photo as the reference). Cap retries. Never auto-decline on a failed match: send it to review. |
| 4 | Server quality check | on every upload | n/a | `unreadable` for a file that fails | The browser check can be skipped by the customer ("upload anyway"), so the server decides. |
| 5 | Bank statement reading | `statement-check` (exists), richer result | the statement file | `monthlyIncome`, salary credit dates, `flags` (gaps, edits, repeated cash credits) | Includes detecting an edited or fake statement. This is what makes private-sector review less manual. |
| 6 | Borderline routing | in `eligibility-check` | n/a | `decision: approved \| declined \| review`, `reasonCodes` | The review band (score 45 to 55) is hard-coded in the app today. Move it here so risk can change it. Queue `review` cases for a person, with an SLA the app can show. |
| 7 | Payslip against verified pay | inside `eligibility-check` and `verify-salary` | `declaredNetPay` | internal `payslipMatch: match \| differs \| unverified` | Flag a big gap for review. Do not show the customer a score or the reason. |
| 8 | Name matching | internal | n/a | internal pass or fail | Match names across BVN, bank account, payslip and ID, with a documented threshold. Show the customer only "the names do not match, check and retry". |
| 9 | Stalled-step follow-up and status updates | events, `GET /api/selfserve/status` | n/a | a status timeline; a `mandate.stalled` event after a set number of hours | Needs a message provider (SMS or WhatsApp), templates, and the customer's consent to be messaged. |

**Questions for the business**
- Which of these may influence a decision, and which only help a person decide?
- Maximum age of a payslip, and the allowed gap between the payslip and the verified pay.
- Thresholds for face match, name match and the review band, and who can change them.
- How long each kind of file is kept.

### 8e. Where and on what device the application was made (for the admin)
The app's server layer now sends an `X-Visitor-Info` header on every call that creates something (the application on `/api/loans`, a statement review, a mandate link, the waitlist). It is percent-encoded JSON, read from the request itself, so the customer cannot change it:
`{ ip?, country?, region?, city?, latitude?, longitude?, timezone?, deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown', os?, browser? }`
- Store it with the application so the admin can show it. Unknown parts are left out.
- **It is the connection's place, not a GPS fix.** The city comes from the network's address, so a mobile network or a VPN can put it elsewhere. Latitude and longitude are rounded to about a kilometre. Treat it as a signal for review, not proof of address.
- **Production needs the CloudFront location headers turned on** (`CloudFront-Viewer-Country`, `-City`, `-Country-Region-Name`, `-Latitude`, `-Longitude`, `-Time-Zone`) in the origin request policy. Without them production shows device and IP only. The Cloudflare worker used in development supplies them already.
- The IP and place are personal data. Add them to the privacy notice and set a retention rule. Say who in the admin can see them.
- **Exact location (optional, built).** On the last screen the customer can tap "Share my location". The browser asks permission, and a "no" never blocks the application. When shared, the application's `loan` object carries `location: { latitude, longitude, accuracyM, capturedAt }` (about a metre of detail; `accuracyM` is how close the phone says it is, so a large number means a rough place). It is absent when not shared. It is held in memory only and never saved on the device.
  - It is reported by the customer's phone, so it can be faked. Compare it with the place the connection comes from (`X-Visitor-Info`) and flag a big gap for review rather than trusting either alone.
  - It is sensitive personal data. The privacy notice must say it is optional, what it is used for, who in the admin can see it, and how long it is kept. I did not write that wording.

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

---

## Decision: keep our BVN-first flow, build on the application API, call it through our server

Updated after the back end's "phase 1 and phase 2" pull request (Princeps-Finance/self-service-apply#1).

### What the live API now covers
Banks, states and local governments, one salary check for IPPIS, Remita and Dedukt, statement review, server-side eligibility, product selection and offers, plus the earlier presigned uploads, OTP, products and submit.

### What is still missing for our flow
1. **A BVN-first start.** Our first question is the BVN. `POST /api/applications` still starts from email and phone, and the OTP goes to the email as well as the BVN-linked phone. We need: start from a BVN alone, return the masked phones and emails tied to it, send the code to the one the customer picks (or to the BVN-linked phone by default), and collect the email later.
2. **Code ownership.** Only a code delivered to the BVN-linked phone may prove ownership. An alternate-phone path needs its own rule (extra check, lower limit or manual review). Today an email the applicant typed receives the same code.
3. **Resend** the code, with a cooldown and attempt limits.
4. **Eligibility before product choice.** Our flow runs eligibility, then shows the products. The API needs a product first. Needed: one call that returns eligibility for every product the customer qualifies for (maximum amount and tenor for each).
5. **A real quote.** The offer's monthly repayment is the amount divided by the tenor and ignores interest and fees. Needed: monthly repayment, total, interest, fees, APR and the schedule from one source.
6. **Your loans.** List a customer's loans, with balance, next due date, repayment progress and mandate state, and one loan in detail.
7. **Repayment mandate.** Create it, and read its state.
8. **Submit.** Match our payload (names, address, state and country ids, bank), make a repeat submit return the same loan, and record the consent version and time.
9. **NIN check** for products that need it (confirm the verification `checkKey`).
10. **Status** with a readable reason, for the status screen.
11. **Referral codes**, if the business keeps them.
12. **Waitlist** for unsupported employment types.
13. **Returning customer**: the safe fields to greet and prefill (first name, employment type, last loan date).

### Which endpoints to build on, ranked by how much the server decides

**Use (the server decides or the file goes straight to storage)**
- `GET /api/products`, `GET /api/products/{id}/journey`, `GET /api/employment-types`
- The salary check (`employment/salary/verify`), `eligibility/evaluate` and `offers`, once the issues in the pull request review are fixed
- `documents/presign`: the file goes straight to storage and never passes through our server
- `otp/*` and `resume/*`, once the code-ownership issue is fixed
- `submit`: the server must price from the stored offer, not from what the browser sends

**Use only through our server, with a fixed list of allowed fields**
- `PATCH /api/applications/{id}` takes free-form `data`. Anything the browser writes there could later be trusted as a fact. Our server should accept only named, validated fields (profile, address, consent) and reject the rest.

**Do not call from the browser**
- `GET /api/files/{applicationId}/{fileId}` is meant for Caltos.
- `verifications/sync`, which lets the client choose a bucket and tier.
- Anything that takes `age` or `existingExposure` from the client: the server must read those from the BVN record and Caltos.

### How the app talks to it
- The browser only calls our own server (same origin). Our server calls the API, so the API's address and credentials never reach the page, and the existing content-security rule that allows only our own origin keeps holding.
- Our server holds the resume token in an httpOnly, secure, same-site cookie. Script on the page can never read it. If that is not possible, keep it in memory and never in `localStorage`.
- Our server allows only the routes above, validates every body, removes anything that is not meant for the customer (for example the raw Caltos customer record), and keeps the bot check and rate limits on code sending.
- Keep the demo build on the mock. The old `/api/selfserve/*` calls are retired once this is wired.

## What the app now expects from the back end (added with the resilience work)

The app works without these (it falls back to safe defaults), but each one removes a dead end.

| Need | What the app does today | What the API should provide |
| --- | --- | --- |
| Step order after the offer | Uses the standard order, or the order set on the product | `POST /api/selfserve/journey` `{ productId }` returning `{ steps: ["nin","documents","identity","offer-letter","mandate","submit"] }` in the order that product needs. Unknown steps are ignored; `submit` is always last; `documents` and `mandate` are never dropped |
| Account name | Shows the name under the account number; the check button waits for it. If the lookup is down, the customer can still continue | `POST /api/selfserve/resolve-account` `{ bankCode, accountNumber }` returning `{ status: "ok", accountName }`, `{ status: "not-found" }` or `{ status: "service-down" }` |
| Why a submit failed | Shows a general message, or a specific one for these codes | On `submit-loan` errors, an `error.code` containing `duplicate`, `already` or `in-progress` (an application is already open), `active-loan` or `exposure` (a loan is still running), or `closed`, `cancel`, `expired` or `offer-changed` (the offer is no longer valid) |
| Session ended | A 401 or 419 on a call that carried the application token opens "Your session timed out" | Return 401 (or 419) when the token has expired, not a generic 500 |
| Safe retries | Reads and anything sent with an idempotency key are tried up to three times on a dropped connection or a 429 or 5xx | Make `submit-loan`, `waitlist` and `statement-review` honour `Idempotency-Key`, so a repeat returns the same record |
| Result validity | The app clears an eligibility result after one hour | Enforce the same hour on the server: `offers` and `submit` should refuse a result older than that |
| Clock check | The app compares the phone clock with the `Date` header on replies and warns when they are more than ten minutes apart | Keep a correct `Date` header on API replies |
| SMS autofill | Android Chrome can read the code from the text message | End the OTP text with `@<site host> #<code>` (the WebOTP format) |
| Face and document checks | Photo, video and documents are collected and sent as before | Match the selfie with the BVN photo, run liveness on the video, read and classify documents, and send only mismatches and edge cases to a person |
| Document upload address | When `upload-document` answers `{ status: "ok", uploadUrl }` with an `https` address, the app sends the file there with a progress bar and up to three tries. Without an address it only records the file name and size, as before | Return a one-time `uploadUrl` (for example a presigned PUT) and allow its host in the page's `connect-src` |
| Holidays that follow the moon | Payday moves back from a weekend or a public holiday; Easter-based and fixed-date holidays are built in | Send the dates of Eid and the Prophet's birthday each year, to add to `EXTRA_HOLIDAYS` in `payday.ts` |

## Repayments come from the server (quote)

The app no longer works out the repayment figures. `POST /api/quote` `{ productId, amount, tenorMonths, referralCode? }` returns the quote
the customer sees, reads aloud, signs and is deducted:

`{ quoteId, expiresAt, productId, amount, tenorMonths, ratePercent, interestModel, monthlyRepayment, fees[], totalFees, totalInterest, totalRepayable, firstDueDate, schedule: [{ month, dueDate, payment, balance }] }`

- **Today** our own server answers it (`api/quote.ts`, using the shared pricing and pay-date rules in `src/shared`), and `submit-loan` checks the
  `quoteId` it receives: the id is signed with `QUOTE_SECRET`, so figures the server never offered, or an expired quote, are refused with 409
  (`QUOTE_INVALID`, `QUOTE_MISMATCH`, `QUOTE_EXPIRED`). Set `QUOTE_SECRET` (16 or more random characters) in production.
- **Later**, when Caltos prices loans, `api/quote.ts` should call it and pass its figures through unchanged. The app needs no change.
- Amounts are in naira, due dates are plain days (`YYYY-MM-DD`), and a quote is valid for one hour.

## Customer accounts

The customer account (sign in, loans, repayments, cards, payoff) is a separate Princeps-owned app, **Princeps Accounts** (repo `princeps-accounts`),
and works across salary backed, BNPL and SME loans. Its model, the API it needs and the delivery order are in that repo's
`docs/accounts-module.md`. Caltos keeps the ledger. This app only links to it ("Already a customer? Sign in" on the welcome page and
"Track your loan" after submitting, through `environment.accountsUrl`).
