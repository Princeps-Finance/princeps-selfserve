# Backend requests for the self-service app

Written against the live OpenAPI spec at `https://self-service-apply.princeps.cloud/docs-json` (**v2.0.0**, all routes under `/api/v2`, Swagger UI at `/docs`). The earlier v0.1.0 spec lived at `https://self-service-api.princeps.cloud`, which now answers 502.
Priority: **P0** blocks a screen or a safety guarantee, **P1** needed for parity with the current app, **P2** can follow.

**Nothing is dropped.** Every request below stays. Under each one, a **v2** line says whether v2 already covers it, covers part of it, or does not. Anything v2 does not cover is still requested.

## v2 at a glance

**How it works**
- Replies come in an envelope: `{ statusCode, code, message, data, status: 'success' | 'error', timestamp }`.
- `POST /api/v2/applications` starts an application and returns a resume token. Every later call sends it as the `x-application-resume-token` header. The reference-data routes are open.
- An application is a set of steps, each `DONE` or `PENDING`. `GET /applications/{id}` returns them with `suggestedNext`. Steps are guidance: only real data dependencies block a call. Changing the employment, the offer or the amount sends the steps after it back to `PENDING` and drops their stored data.
- Error codes named in the spec: `OTP_RESEND_TOO_SOON` (with `retryAfterSeconds`), `OTP_LOCKED`, `OTP_INVALID`, `BVN_SESSION_EXPIRED`, `ACCOUNT_NAME_MISMATCH`, `APPLICATION_CLOSED`, `APPLICATION_NOT_CANCELLABLE`, `OFFER_LETTER_CHANGED`, `IDENTITY_DISCREPANCY` (409 when a BVN contact belongs to a different Caltos customer) and `DIGISIGN_NOT_CONFIGURED` (503). Errors carry `{ statusCode, code, message, reasons[] }`.
- The steps, in order: `verification`, `profile`, `employment`, `salary`, `eligibility`, `offer`, `terms`, `documents`, `identity`, `offerLetter`, `mandates`, `submit`. There is no NIN step.
- The only parameters anywhere are the application `id`, the state `code` and the resume-token header. There are no query parameters and no `Idempotency-Key` header.
- Starting with a BVN that already has an open application reopens it (`resumed: true`), and the contact and code steps restart. The resume token is shown once, so the app must keep it.

**The 32 endpoints**

| Group | Endpoints |
|---|---|
| Reference data (open) | `GET employment-types`, `banks`, `states`, `states/{code}/lgas`, `mdas`, `paramilitary/employers` |
| Application | `POST /applications` (BVN and consent), `GET /applications/{id}`, `otp/send`, `otp/verify`, `contact-unreachable`, `identity/reset`, `cancel`, `GET` and `PUT profile`, `PUT employment`, `bank/resolve-account`, `PUT salary`, `steps/terms/complete`, `submit`, `GET status` |
| Eligibility and offers | `POST eligibility`, `GET offers`, `POST quote`, `POST offer/select`, `GET offer` |
| Documents and identity | `documents/presign`, `GET documents`, `identity/start`, `GET identity` |
| Offer letter | `GET offer-letter`, `POST offer-letter/accept` (sends the letter's `hash`) |
| Mandates | `POST mandates`, `GET mandates` |

## P0

### 1. List a customer's loans (blocks the "Your loans" screen)
**v2: not covered.** No loans, balances or repayments endpoint. Still requested.
No endpoint exists for existing loans, balances or repayments.
- Suggested: `GET /api/applications/{id}/loans` (resume token, only after OTP is verified and the Caltos customer is `FOUND`).
- Return for each loan: `id`, `reference`, `productName`, `status` (`active` | `overdue` | `completed`), `principal`, `outstanding`, `monthlyRepayment`, `nextDueDate`, `instalmentsPaid`, `instalmentsTotal`, `ratePercent`, `tenorMonths`, `disbursedAt`, `mandateStatus`.
- Money as numbers in a stated unit (naira or kobo), dates as ISO strings. Include paid-off loans.
- Also confirm which fields of `caltosCustomer` on the application are safe to show a returning customer (first name, employment type, employer, last loan date).

### 2. One source of truth for pricing
**v2: mostly covered.** `POST /quote` prices an amount and tenor with the Caltos calculator (and answers `eligible: false` with `reason` and `maxAmountForTenor` as a normal 200), `POST /offer/select` locks it with the full repayment schedule, and `GET /offer` returns it exactly as locked. The calculation has `loanAmount`, `duration`, `rate`, `interest`, `fees[]` (each a name, type and amount), `totalRepayment`, `installmentRepayment` and the start, first and last repayment dates. An answer of `eligible: false` carries a `reason` (`AMOUNT_EXCEEDS_ELIGIBILITY`, `REPAYMENT_EXCEEDS_ELIGIBILITY`, `AMOUNT_BELOW_MINIMUM`, `TENOR_NOT_ALLOWED` or `CALCULATION_REJECTED`), `maxAmountForTenor`, `minAmount` and `allowedTenors`. Eligible products come with `tenorOptions`, so the app should offer those tenors, not a fixed range. Still to confirm: what the `rate` object holds (per month, year or tenor), and whether fees come off the amount received or are added to repayments. Once the app is wired to v2 our own `api/quote.ts` is no longer needed.
The app currently carries its own catalogue and repayment maths, which can drift from Caltos.
- Clarify on `GET /api/products`: the unit of `rate` (per month, per year, per tenor), `interestType`, `interestChargeFrequency`, how `processingFee` is expressed (percent or flat, one or several fees), amount step, and repayment frequency.
- Better: `POST /api/products/{id}/quote` with `{ amount, tenor }` returning `monthlyRepayment`, `totalRepayment`, `interest`, `fees[]`, `apr` and the repayment `schedule[]`. The app then displays exactly what Caltos will charge, and the "estimated yearly rate" becomes the real one.
- State whether fees are deducted from the amount received or added to repayments.

### 3. Safe retries on submit and other creating calls
**v2: covered for submit.** `submit` is documented as safe to repeat: a submitted application returns its status again. `mandates` is safe to repeat and a repeat `identity/start` returns the open request. The spec has no `Idempotency-Key` header. Still requested: honour the key on whatever v2 gains for the waitlist and statement review (item 11), and guard against two concurrent applications for the same BVN (v2 reopens the open one, which covers this).
The app now sends an `Idempotency-Key` (a UUID, the same on every retry of one action) with the loan submit, mandate creation, statement review and waitlist signup. The back office must store the key with the result and return the same result for a repeat, for at least 24 hours.

`POST /api/applications/{id}/submit` returns 409 if already submitted. After a timeout the customer cannot tell whether the loan was created.
- Make a repeat submit for the same application return the existing loan (200) instead of 409, or accept an `Idempotency-Key` header.
- Guard against two concurrent applications for the same BVN.

### 4. Eligibility decided on the server
**v2: covered.** `POST /eligibility` runs the salary source for the employment type (WACS maximum amount; Dedukt, Remita or an MDA API maximum monthly repayment; or review only), filters the products and prices each at 12 months. The result is locked until `expiresAt`. `GET /offers` re-reads it and answers 410 afterwards, and `offer/select` and `submit` re-check against it. The outcome is `APPROVE`, `REFER` or `DECLINE`, and `manualReview` and a `review` object (`required`, `reasons[]`, `reviewHold`) say when a person looks at it. `REFER` is the review decision the app computes itself today, so the app can use the server's. Still requested: machine-readable reason **codes** (today `reasons` are plain strings the app cannot translate into four languages), and the review band staying on the server (see 8d item 6).
Scoring runs in the browser today, so it can be bypassed.
- Suggested: `POST /api/applications/{id}/eligibility` returning `decision` (`approved` | `review` | `declined`), `maxAmount`, `maxTenorMonths` and machine-readable reason codes (the app translates them).
- Submit should refuse an amount above that maximum.

### 5. Repayment mandate
**v2: covered.** `POST /mandates` sets up two per customer: Mono direct debit (approved at the returned `actionUrl`) plus the employment type's payroll provider (Federal WACS, State Remita, Paramilitary Dedukt; NYSC has Mono only). `GET /mandates` re-reads the providers and `complete` is true when every required mandate is `ACTIVE`; a mandate is `PENDING`, `REQUIRES_ACTION`, `ACTIVE`, `FAILED` or `STOPPED`. The app's link mode maps to the Mono `actionUrl`; the tick-box "authorize" mode has no counterpart, so confirm whether v2 still allows it.
The app has a mandate step (link or authorize, then status). Nothing in the spec covers it.
- Needed: create a mandate (returns a link or reference), `GET` its status (`pending` | `authorized` | `failed`), and how it ties to the application and submit.

### 5a. The offer letter (PDF)
**v2: covered, one detail to confirm.** `GET /offer-letter` is built from the locked offer and returns a `hash` for that exact version. `POST /offer-letter/accept` takes the `hash` and records the agreement with time, IP and user agent, and answers 409 `OFFER_LETTER_CHANGED` if the letter changed. **The letter comes back as HTML** (`{ html, hash, accepted }`), not a PDF. The app shows a PDF today and will need to show HTML safely (sanitised, and inside a sandboxed frame so nothing in it can run). Please say whether a PDF version can also be returned, and whether the DigiSign letter (a PDF in Princeps' template) is the same text.
The terms step now shows the customer's offer letter in a PDF viewer. Needed: an endpoint that returns the PDF for the offer the customer is about to accept (for example `GET /api/applications/{id}/offer/document`), as `application/pdf`, under 5 MB, with the same amount, tenor, rate, fees and total as the offer. Our server wraps it as `{ pdfBase64 }` and refuses anything that does not start with `%PDF-`. Until it exists, the demo build shows a sample letter.

### 6. Identity capture and documents
**v2: covered, with a new path.** `documents/presign` takes `documentType` of `gov-id`, `payslip`, `selfie-with-id` or `terms-video` (one file per type, a repeat replaces it; images and PDFs for the first two, images for the selfie, video for the terms video, at least 1 KB). `GET /documents` returns `required` and `missing`, and `identityRequired`, `identityMissing` and `identityDone`. Identity is confirmed either by uploading both identity documents (what the app does today) **or** through DigiSign: `POST /identity/start` returns a `signingUrl` where the customer holds up their ID, reads lines aloud and signs, and `GET /identity` reports `NOT_STARTED`, `PENDING`, `VERIFIED`, `REVIEW` or `FAILED`. `presign` answers `{ fileId, uploadUrl, uploadMethod: 'PUT', uploadHeaders, expiresIn }`: the app must send those headers on the `PUT`, and the storage host must be allowed in the page's `connect-src`. `identity` can also carry a `failureReason`. If DigiSign is not set up, `identity/start` answers 503 `DIGISIGN_NOT_CONFIGURED` (see `digisignAvailable`). The DigiSign path needs a new screen in the app (open the link, then poll). Decision for the business: which path, or both.
*Update: face matching will be done by the back end, so the app does not need a liveness endpoint. It only needs the upload and a way to read the match result.*

`documents/presign` exists, which is what the app needs for photo, video and documents.
- List the allowed `documentType` values per product (selfie, video, payslip, ID, and so on), accepted content types and size limits.
- Say how an upload is confirmed after the S3 PUT, and how a liveness or face-match result is returned.

## P1

### 7. Start, OTP and resend
**v2: covered.** `POST /applications` starts from the BVN and consent alone, looks the BVN up at Caltos and then the BVN provider, and returns the masked contacts and the resume token. `otp/send` sends a 6-digit code (valid 5 minutes) to one chosen contact, with a cooldown (`429 OTP_RESEND_TOO_SOON` and `retryAfterSeconds`), so resend is the same call. `otp/verify` locks after five wrong tries and returns 410 `BVN_SESSION_EXPIRED` when the BVN session ran out. The email is optional and comes in with the profile. **`otp/send` can return a `devCode`: it must never be returned in production.** `identity/reset` handles "Not you?" and `cancel` closes an application.
The app asks for the BVN first and sends the code to the BVN-linked phone. `POST /api/applications` requires `email`, `bvn` and `phone`.
- Make `email` optional, and `phone` optional when it comes from the BVN record.
- Document when the OTP is sent, and add a resend endpoint with a cooldown and attempt limits.
- Return the BVN identity needed to prefill and check the profile (name, date of birth, address) and say what is deliberately withheld.

### 7a. Choose where the code goes (new in the BVN step)
**v2: covered for the choice, decision still open for the alternate number.** Masked contacts come back from `POST /applications` and `otp/send` takes the chosen `contactId`. A Mono-backed BVN can also use an alternate phone (`phoneNumber`). `contact-unreachable` records that none can be reached and returns how to reach support (`null` for channels not configured): the app should show those instead of its own constants. The security question in the third bullet below is still open.
After the customer enters a BVN, the app shows the phones and emails tied to it, partly hidden, and lets them pick where to get the code. If they can reach none of them they type another phone number.
- `POST bvn-contacts` `{ bvn, captchaToken }` returns `{ status, phones: [{ id, masked }], emails: [{ id, masked }] }`. Only masked values and opaque ids ever leave the server. Same bot check and per-BVN limits as the code send.
- The code send takes an optional destination: `{ kind: 'bvn-contact', id }` or `{ kind: 'alternate-phone', phone }`.
- **Security decision needed.** A code sent to a number the customer typed proves they hold that number, not that the BVN is theirs. Pick the extra check for the alternate-number path (for example matching name and date of birth against the BVN record, a lower first-loan limit, or manual review) and have the API flag the application so the status screen can say what happens next.
- **Privacy.** Showing masked contacts to anyone who types a BVN reveals that the BVN exists and a few digits. Keep the masking heavy (last two digits of a phone, first letter and domain of an email), rate limit per BVN and per IP, and never log the values.

### 8. Salary and employment checks
**v2: covered.** `PUT /employment` takes `type` (`federal`, `state`, `paramilitary` or `nysc`) with `mdaCode`, `employerId` or `monthsLeftInService`. `bank/resolve-account` returns the account holder name and `nameMatchesBvn`. `PUT /salary` takes bank and account plus `ippisNumber` (federal) or `serviceNumber` (paramilitary, and state MDAs verified through Dedukt), and rejects `ACCOUNT_NAME_MISMATCH`.

| Our type | v2 `type` | Extra |
|---|---|---|
| Government, federal | `federal` | `ippisNumber` on salary |
| Government, state | `state` | `mdaCode` from `GET /mdas`; `serviceNumber` on salary where the MDA goes through Dedukt |
| Paramilitary | `paramilitary` | `employerId` from `GET /paramilitary/employers`; `serviceNumber` |
| NYSC corper | `nysc` | `monthsLeftInService` |
| Private sector | none (`COMING_SOON`) | see 11 |
| Own business | none (`COMING_SOON`) | see 11 |

**Question.** The app lets federal staff choose IPPIS or Remita. In v2 the payroll provider follows the employment type (Federal WACS, State Remita, Paramilitary Dedukt) and there is no channel to send. Does any federal staff member need Remita? If so, v2 needs a way to say so.
IPPIS, Remita and Dedukt checks exist. Document the exact request and response, including the verified monthly income, the error cases the app must show (not found, mismatch, service down), and the mapping from our employment types and channels.

### 8a. State government: states and employers (new screen)
**v2: partly covered.** `GET /mdas` lists the state governments the customer can pick, as `{ code, name, state }`: today **Ondo, Cross River, Gombe, Ekiti, Plateau, Delta and Katsina**. Adamawa is not in it, and there are no employers inside a state (SUBEB, LGA, PHCDA). Which payroll provider an MDA uses is decided on the server. Still requested, so the screen can follow without a release:
- Add the Adamawa MDAs (SUBEB, LGA, PHCDA), with **PHCDA verified through Dedukt** (so it takes a `serviceNumber`). Confirm whether SUBEB and LGA use Remita.
- Confirm whether **Ekiti** is served: it is in `/mdas` but was not on the business's list.
- If a state has several employers, return them with the MDA (for example `employers: [{ code, name }]`) so the app can ask the second question. Return the payroll provider per MDA so the app can show the right salary form.
- The app's bundled fallback lists Adamawa and not Ekiti. It should match `/mdas` once this is settled.

State government staff now pick their state, and for some states an employer, before the salary details. The app already ships a default list, so this is configuration, not a blocker.
- `GET /api/state-employers` returns `{ states: [{ code, name, channel, employers: [{ code, name, channel }] }] }`. `channel` is `remita`, `ippis` or `dedukt` and says how repayments are collected. An employer without a `channel` inherits its state's.
- Today's default: Adamawa (SUBEB, LGA, PHCDA), Cross River, Delta, Gombe, Katsina, Ondo, Plateau. **PHCDA is `dedukt`. SUBEB and LGA are assumed `remita`: please confirm.**
- Add or remove a state or employer here and the app follows without a release. The app falls back to its own list when this cannot be reached.
- For an employer on `dedukt`, the app sends the employer's name in `employer` on the salary check, in place of the paramilitary employer list. Please confirm the names the salary check expects.

### 8b. Payslip scan
**v2: not covered.** `payslip` is only a document type to upload, with no reading and no figures. Eligibility comes from the salary source on the server, not from a payslip. Still requested: the reading endpoint below, and `declaredNetPay` as evidence only.

**Who is asked for a payslip.** In v2, `GET /documents` already returns `required` and `missing` per customer. If a payslip appears in `required`, that is the signal to offer the upload, and a separate `salary-requirements` call would not be needed. The catch is that our upload sits on the salary screen, before the documents step. Either `GET /documents` can be read once the employment and salary are saved, or the answer to `PUT /salary` carries a `payslipRequired` flag. Until one of these exists, the request below stands.
The salary screen offers an optional "scan your payslip".
- `POST /api/selfserve/payslip-extract`, multipart with `file` (JPEG, PNG, WebP, HEIC or PDF, up to 10 MB) and `captchaToken`. Answers `{ status: 'ok', figures: { netMonthly, grossMonthly?, month?, employer? } }` (naira, `month` as `YYYY-MM`). Use `413` for too large, `415` for a type not accepted, `429` for the limit, and `{ status: 'unreadable' }` when nothing usable was read.
- Run the reader on the server, so the payslip is not handled by a browser library. Say how long the file is kept. A payslip holds salary and employer details, so it needs the same care as the other documents.
- The customer confirms or corrects the figures, then the app sends them as `declaredNetPay` on `eligibility-check` and `verify-salary`. **Treat it as evidence, never as the verified pay**: eligibility stays decided on the server.

**Who is asked for a payslip.** `POST /api/selfserve/salary-requirements` with `{ employmentType, channel, governmentLevel?, stateCode?, employerCode? }` answers `{ payslip: true | false }`. The screen asks it when it opens and again whenever the pay channel changes, and shows the upload only on `true`. Remita alone does not mean a payslip: the decision is yours, per product, state or employer. An error or no answer means no upload, so the app never blocks a customer on this.

### 8c. Bank list and logos
**v2: partly covered.** `GET /banks` returns 25 banks as `{ code, name }`. Heritage Bank (030) is still listed, there is no Titan Trust entry, and no `logo`. Opay is `999992`, Palmpay `999991` and Kuda `50211`, which differ from the codes in the app's own fallback list. Please confirm these are the real codes (they look like placeholders). Still requested: the current licensed list and the optional `logo` below.

`banks` should return the current licensed list (including OPay, Kuda, PalmPay and the other digital banks) with each bank's real NIBSS code, and an optional `logo`: a path on our own site such as `/banks/044.svg`. Our security policy only allows images from our own site, so serve the logo files from there. A bank with no logo shows its initials.

### 8d. Automation: what each piece needs from the back end
**v2: only the identity states exist** (`VERIFIED`, `REVIEW`, `FAILED` from DigiSign or the uploads, see 6). Reading a payslip or an ID, face matching and liveness, statement reading, name matching, borderline routing and stalled-step follow-up are all still requested.

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
**v2: not covered, and the shape has to change.** `POST /submit` takes no body ("everything is assembled from what was saved"), so our `location` field and header have nowhere to go. v2 already records time, IP and user agent when the offer letter is accepted. Still requested:
- Accept the `X-Visitor-Info` header below on the calls that create something (`POST /applications`, `offer-letter/accept`, `submit`), and store it with the application.
- Add an optional call to save the shared location before submit, for example `PUT /applications/{id}/location` with `{ latitude, longitude, accuracyM, capturedAt }`. The app will call it only when the customer chose to share, and a refusal sends nothing.

The app's server layer now sends an `X-Visitor-Info` header on every call that creates something (the application on `/api/loans`, a statement review, a mandate link, the waitlist). It is percent-encoded JSON, read from the request itself, so the customer cannot change it:
`{ ip?, country?, region?, city?, latitude?, longitude?, timezone?, deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown', os?, browser? }`
- Store it with the application so the admin can show it. Unknown parts are left out.
- **It is the connection's place, not a GPS fix.** The city comes from the network's address, so a mobile network or a VPN can put it elsewhere. Latitude and longitude are rounded to about a kilometre. Treat it as a signal for review, not proof of address.
- **Production needs the CloudFront location headers turned on** (`CloudFront-Viewer-Country`, `-City`, `-Country-Region-Name`, `-Latitude`, `-Longitude`, `-Time-Zone`) in the origin request policy. Without them production shows device and IP only. The Cloudflare worker used in development supplies them already.
- The IP and place are personal data. Add them to the privacy notice and set a retention rule. Say who in the admin can see them.
- **Exact location (optional, built).** On the last screen the customer can tap "Share my location". The browser asks permission, and a "no" never blocks the application. When shared, the application's `loan` object carries `location: { latitude, longitude, accuracyM, capturedAt }` (about a metre of detail; `accuracyM` is how close the phone says it is, so a large number means a rough place). It is absent when not shared. It is held in memory only and never saved on the device.
  - It is reported by the customer's phone, so it can be faked. Compare it with the place the connection comes from (`X-Visitor-Info`) and flag a big gap for review rather than trusting either alone.
  - It is sensitive personal data. The privacy notice must say it is optional, what it is used for, who in the admin can see it, and how long it is kept. I did not write that wording.

### 8f. NIN check (some products)
**v2: not covered.** There is no NIN step or endpoint in v2 (the steps are listed above). The app asks for a NIN only where a product sets `requiresNin` (today the Dedukt and NYSC products), and the check matches the NIN to the customer's name and date of birth. Still requested: a NIN verification call, and a `nin` step so it shows in `suggestedNext`.

### 9. Application status for the customer
**v2: covered, one detail to confirm.** `GET /status` has the same body as `submit` (the `reference` and `loanId`, null before submission) and can be read at any time after the code is verified. Application status is `DRAFT`, `UNDER_REVIEW`, `SUBMITTED`, `FAILED` or `CANCELLED`. `manualReview`, `reviewReasons[]` and `pendingSteps` (`terms`, `mandates`) are returned. Please confirm the review reasons are written for the customer and can be translated, or give codes.
A status read that returns the reference, state (received, under review, approved, declined, disbursed) and a human-readable reason, so the status screen can show more than "received".

### 10. Referral codes
**v2: partly covered.** `POST /quote` and `offer/select` accept a `referralCode`. There is no call that only checks a code and returns its discount, which the app uses to show the saving before an amount is chosen. Still requested.
There is no referral concept. Decide whether to support it:
- If yes: a validate call (`GET /api/referral-codes/{code}` returning the discount), a `referralCode` field on submit, and the discount applied by Caltos product rules so the quote matches.
- If no: the app removes the feature.

### 11. Private-sector statement review and waitlist
**v2: not covered.** Private sector and own business are `COMING_SOON` in `GET /employment-types`, and there is no statement review or waitlist endpoint. Still requested.
The app sends a bank statement review request and a waitlist signup for unsupported employment types. Neither is in the spec.

## P2

### 12. Operational
**v2:** the spec lists no `servers`, and the only security scheme is the per-application resume token (`x-application-resume-token`). The stable error codes in the spec are a good start: please list them all. **Please also confirm which host the app should call.** The v2 docs are at `self-service-apply.princeps.cloud`; the older `self-service-api.princeps.cloud` returns 502, and our worker's `SELF_SERVICE_API_URL` still points at it.

- A sandbox with test BVNs and OTPs.
- CORS policy, or confirmation that only our server calls the API. The spec lists no `servers`, and the only auth scheme is the per-application resume token, so say whether any other key is required.
- Resume token lifetime and what happens when it expires.
- Stable machine-readable error codes alongside the NestJS `statusCode` and `message`.
- Rate limits per route, and the personal data each response contains.

### 13. Product and policy decisions we need from the business
- The reminder schedule for repayments (how many days before and after the due date), so it can be shown to customers.
- Which loan states count as "overdue".

---

## Flow step by step: what v2 covers

Legend: **Yes** = an endpoint exists and fits; **Partly** = exists but needs the change noted; **Missing** = nothing in v2, still requested.

| Step in our flow | What the app needs | v2 | Status |
|---|---|---|---|
| Language | nothing | none needed | n/a |
| Enter BVN, send code to the BVN-linked phone | verify the BVN, send a code, get the identity back | `POST /applications`, `otp/send` | **Yes** |
| Where the code goes | masked contacts; send to one, or an alternate phone | contacts in `POST /applications`; `otp/send` with `contactId` (and `phoneNumber` for Mono) | **Yes** (alternate-number rule still open, see 7a) |
| Resend the code | resend with a cooldown | `otp/send` again (`429 OTP_RESEND_TOO_SOON`) | **Yes** |
| Verify the code | check the code, return a token | `otp/verify` | **Yes** |
| "Not you?" / wrong BVN | close and start again | `identity/reset`, `cancel` | **Yes** |
| None of the contacts reachable | tell support | `contact-unreachable` (returns support channels) | **Yes** |
| Returning customer | greet and prefill safely | profile is "prefilled from earlier details if they have applied before" | **Partly** (which safe fields, see 1) |
| Your loans (returning customers) | loans, balances, next due date, mandate state | none | **Missing** (see 1) |
| Profile | address, state, LGA, status, religion, email | `GET` and `PUT profile`, `GET states`, `GET states/{code}/lgas` | **Yes** |
| Employment type | list the types and whether open | `GET employment-types`, `PUT employment` | **Yes** (private sector and own business are `COMING_SOON`) |
| State government: state and employer | pick a state, then an employer | `GET mdas` (7 MDAs), `mdaCode` on `PUT employment` | **Partly** (no Adamawa, no employers inside a state, see 8a) |
| Paramilitary employer | pick an employer | `GET paramilitary/employers`, `employerId` | **Yes** (demo data today) |
| Bank list and account name | list banks, confirm the account name | `GET banks`, `bank/resolve-account` | **Yes** (no logos, list to refresh, see 8c) |
| Salary check | verify employment and income | `PUT salary` (IPPIS or service number) | **Yes** |
| Payslip upload | an optional payslip with read figures | `documents/presign` (`payslip`) only | **Partly** (no reading, see 8b) |
| Private-sector statement review | send a statement for review | none | **Missing** (see 11) |
| Waitlist | save a contact against a type | none | **Missing** (see 11) |
| Eligibility | decision, maximum amount and tenor, reasons | `POST eligibility`, `GET offers` | **Yes** (`APPROVE`, `REFER`, `DECLINE`; reason codes still wanted, see 4) |
| Offers and product choice | products with rate, limits, tenor, fees | eligibility prices every eligible product | **Yes** |
| Quote for an amount and tenor | monthly repayment, total, interest, fees | `POST quote`, `POST offer/select`, `GET offer` | **Yes** (units and fees to confirm, see 2) |
| Referral code | validate and apply a discount | `referralCode` on `quote` and `offer/select` | **Partly** (no validate-only call, see 10) |
| Terms | record the terms step | `steps/terms/complete` | **Yes** |
| NIN check (some products) | verify the NIN | none | **Missing** (see 8f) |
| Documents | upload and list required and missing | `documents/presign`, `GET documents` | **Yes** |
| Identity | selfie and video, or DigiSign | `presign` for `selfie-with-id` and `terms-video`; `identity/start`, `GET identity` | **Yes** (DigiSign needs a new screen, see 6) |
| Offer letter | read it and accept | `GET offer-letter`, `offer-letter/accept` | **Partly** (the letter is HTML, not a PDF, see 5a) |
| Repayment mandate | set up, then read its status | `POST mandates`, `GET mandates` | **Yes** (see 5) |
| Submit | create the loan | `POST submit` (no body) | **Yes** (a repeat returns the status; place and device, see 8e) |
| Status screen | reference, state, reason | `GET status` | **Yes** (readable reason, see 9) |
| Save and resume | continue on another device | the application and its steps, with the resume token | **Yes** (this can replace the draft kept on the device) |
| Where and on what device | store the device and place | none | **Missing** (see 8e) |

### The flow-order mismatch is settled
In the earlier spec a product was bound to the application first. In v2 the customer starts from the BVN, and eligibility runs before any product is chosen: `POST eligibility` returns every product they qualify for, then `quote` and `offer/select` fix one. That matches our flow.

---

## Decision: build on the v2 application API and call it through our server

### What v2 now covers
The BVN-first start, contact choice and resend, profile and states, employment types and MDAs, bank list and account name, salary, server-side eligibility, quote and offer, documents and identity (uploads or DigiSign), the offer letter, mandates, submit and status.

### What is still missing for our flow
1. **Your loans**: list a customer's loans, with balance, next due date, repayment progress and mandate state, and one loan in detail.
2. **Waitlist** for employment types that are not open.
3. **Private-sector statement review**.
4. **Payslip reading**, and who is asked for one (see 8b).
5. **Adamawa, and employers inside a state** (see 8a), plus the payroll provider per MDA.
6. **Place and device capture** (see 8e).
7. **Bank logos**, and the current licensed bank list (see 8c).
8. **A validate-only referral call** (see 10).
9. **Machine-readable reason codes** from eligibility and the review reasons (see 4 and 9).
10. **The offer letter as a PDF**, or a safe way to show the HTML (see 5a).
11. **NIN check** (see 8f).
12. **Returning customer**: the safe fields to greet and prefill (first name, employment type, last loan date).
13. **The automation** in 8d.

### How the app talks to it
- The browser only calls our own server (same origin). Our server calls v2, so the API's address and credentials never reach the page, and the content-security rule that allows only our own origin keeps holding.
- Our server holds the resume token in an httpOnly, secure, same-site cookie, so script on the page can never read it. If that is not possible, keep it in memory and never in `localStorage`.
- Our server allows only the routes the app needs, validates every body, removes anything that is not meant for the customer, and keeps the bot check and rate limits on code sending.
- Our server maps the app's names to v2's (the employment table in 8, and `corper` to `nysc`) and adds the visitor information (8e).
- Keep the demo build on the mock. The old `/api/selfserve/*` calls are retired once this is wired, and anything v2 does not cover stays on them until it does.

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

**v2 against this table**
- **Account name:** covered by `bank/resolve-account` (with `nameMatchesBvn`).
- **Result validity:** covered by `expiresAt` on eligibility, and 410 on `offers` once it has passed.
- **Session ended:** the spec lists 401 on protected calls. Please confirm it is also returned when the resume token has expired, and say how long a token lives.
- **Step order after the offer:** v2 has `suggestedNext` on the application but no per-product order. Still requested.
- **Why a submit failed, safe retries, clock check, SMS autofill, face and document checks, document upload address, holidays:** unchanged. Document uploads already use a presigned `uploadUrl` in v2.

## Repayments come from the server (quote)

The app no longer works out the repayment figures. `POST /api/quote` `{ productId, amount, tenorMonths, referralCode? }` returns the quote
the customer sees, reads aloud, signs and is deducted:

`{ quoteId, expiresAt, productId, amount, tenorMonths, ratePercent, interestModel, monthlyRepayment, fees[], totalFees, totalInterest, totalRepayable, firstDueDate, schedule: [{ month, dueDate, payment, balance }] }`

- **Today** our own server answers it (`api/quote.ts`, using the shared pricing and pay-date rules in `src/shared`), and `submit-loan` checks the
  `quoteId` it receives: the id is signed with `QUOTE_SECRET`, so figures the server never offered, or an expired quote, are refused with 409
  (`QUOTE_INVALID`, `QUOTE_MISMATCH`, `QUOTE_EXPIRED`). Set `QUOTE_SECRET` (16 or more random characters) in production.
- **Later**, when Caltos prices loans, `api/quote.ts` should call it and pass its figures through unchanged. The app needs no change.
- Amounts are in naira, due dates are plain days (`YYYY-MM-DD`), and a quote is valid for one hour.
- **v2:** `POST /quote` and `offer/select` do this on the server and `GET /offer` returns the locked offer with the schedule. When the app is wired to v2 our own `api/quote.ts` and the signed `quoteId` are replaced by them, once the points in request 2 are confirmed.

## Customer accounts

The customer account (sign in, loans, repayments, cards, payoff) is a separate Princeps-owned app, **Princeps Accounts** (repo `princeps-accounts`),
and works across salary backed, BNPL and SME loans. Its model, the API it needs and the delivery order are in that repo's
`docs/accounts-module.md`. Caltos keeps the ledger. This app only links to it ("Already a customer? Sign in" on the welcome page and
"Track your loan" after submitting, through `environment.accountsUrl`).
