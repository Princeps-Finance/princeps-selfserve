# Princeps Self-Service Loan Portal — Flow Spec

**Domain:** apply.princepsfinance.com
**Type:** New, separate front door. Not a rebuild of Caltos. Backend does not exist yet — build against a service-layer abstraction (see Architecture Note at bottom).

---

## Current flow (as built)

This section is the source of truth. The numbered steps below are the original design and are kept for the
reasoning behind each decision; where they disagree with this section, this section wins.

```
Language → Welcome (apply | just checking)
  → BVN → code sent to the BVN-linked phone → Profile
  → Employment → Salary (or Statement review for private sector; Waitlist for unsupported types)
  → Eligibility → Offers (optional referral code) → Terms
  → NIN (only if the product needs it) → Documents → Identity check (photo + video)
  → Offer letter (accepted in a window) → Mandate (the last thing set up) → Submit → Status
```

Changes from the original steps 1 to 9:
- Steps 1, 1a and 2 (phone and email capture, email OTP) were replaced by BVN first. The OTP goes to the phone linked to the BVN.
- The profile is collected before employment, not after the offer (original step 8).
- BVN is the first question (original step 9), and NIN is asked only for products that require it.

How the flow is enforced:
- Every URL is named once in `src/app/core/flow/apply-routes.ts`. Steps move with `FlowNavigator` and never build URLs.
- A step opens only when its prerequisites exist. These checks are route guards in `src/app/core/flow/guards.ts`, not code inside the steps.
- Changing the employment, salary or offer clears everything decided after it (eligibility, offer, terms, mandate, documents, identity check), so an old decision can never be submitted against new details.
- A received application is final: the submit step cannot be opened again, and each application carries one idempotency key so a retry cannot create a second loan.
- The server recomputes all money (rate, repayment, referral discount, product limits) and rejects anything that disagrees.

Not built yet:
- Step 4's "service unavailable, we'll notify you" state, and the "Other employer" manual-review path (only a string is sent today).
- Photo, video and document files are not sent to the back office; only metadata and a review hint are.
- Server-side eligibility scoring: it runs in the browser, so the back office must re-score.

## Step 0 — Language Selection

**Flow:** First screen. English / Yoruba / Igbo / Hausa. Persists for the whole session.

**Edge cases:**
- User switches language mid-flow (e.g., on step 6) — all previously entered data must persist, only labels/copy re-render.
- Untranslated string fallback: if a translation key is missing, fall back to English silently — never show a raw key like `apply.step3.title`.
- Money and number formatting must stay locale-correct regardless of language (₦ symbol, thousands separators) — language ≠ number format.
- Language choice should be remembered if the user returns (cookie/localStorage), so they don't re-select every session.

---

## Step 1 — Phone + Email Capture

**Flow:** Collect phone number and email. Phone gets format/existence validation only (no OTP). Email gets OTP.

**Edge cases:**
- Phone number formats: user may type with/without leading 0, with/without +234 — normalize to one canonical format before storing.
- Email typo detection (e.g. "gmial.com") — non-blocking warning, don't hard-block submission.
- Duplicate detection: phone or email already exists in system → this is a **returning customer**, branch flow accordingly (see Step 1a).
- User abandons after this step and returns later — should resume, not restart, if within a reasonable session window.

## Step 1a — Returning Customer Detection

**Flow:** If phone/email matches an existing profile, skip profile creation later and go straight to employment/salary info (or straight to eligibility if that's already on file and still valid).

**Edge cases:**
- Existing customer's profile info is stale (e.g., they changed jobs) — offer an explicit "update your details" option rather than silently reusing old data.
- Existing customer already has an active loan on one product — must still allow applying to a *different* product, but flag cross-product exposure at the eligibility step (see Step 5).
- Existing customer was previously declined — decide whether to show that history or let them re-apply fresh (needs a business rule, don't assume).

---

## Step 2 — Email OTP Verification

**Flow:** Send OTP to email, user enters code.

**Edge cases:**
- OTP not received: resend with cooldown timer (avoid spam-triggering email providers), cap resend attempts (e.g., 5 per hour).
- OTP expired: clear error state, allow immediate resend.
- Wrong code entered repeatedly: lock after N attempts, with a cooldown, not a permanent lock.
- User's email OTP lands in spam — consider a "check spam folder" hint after 1 failed wait, not upfront (avoid implying failure before it's happened).

---

## Step 3 — Employment Type Selection

**Flow:** Government / Paramilitary / Private Sector / Corper / Own Business.

**Edge cases:**
- "Private sector" and "own business" — confirm whether these currently lead anywhere (do you have products for them yet, or is this UI ahead of the backend eligibility rules)? If not launch-ready, either hide them or mark "coming soon" rather than let users fall into a dead-end flow.
- User selects wrong category and needs to go back — back navigation must not wipe OTP/phone/email already captured.

---

## Step 4 — Salary Channel Branch

### 4a. Remita
Collect: salary bank, salary account number.

**Edge cases:**
- Account number length/format validation per bank (Nigerian banks vary — 10-digit NUBAN is standard, but validate against selected bank if you have bank-specific rules).
- Bank name selection should be a searchable dropdown, not raw text entry (typos break downstream verification).
- Remita verification call fails/times out — must have a distinct error state from "verification failed because the data is wrong" vs. "the verification service is down." Users need different messaging for each.

### 4b. IPPIS
Collect: salary bank, salary account number, IPPIS number.

**Edge cases:**
- IPPIS number format validation (confirm expected length/pattern with risk team).
- IPPIS number belongs to someone else / mismatch with name on file — must be caught and surfaced clearly, not silently passed through to a low eligibility score.

### 4c. Paramilitary / Dedukt
Collect: employer (dropdown: NSCDC, Nigerian Correctional Services, Nigeria Immigration, Adamawa State SUBEB), then IPPIS number, salary bank, account number.

**Edge cases:**
- Employer dropdown is currently a fixed list — what happens if someone's paramilitary employer isn't listed? Need an "other / not listed" path that doesn't dead-end them (route to manual review or a waitlist, don't just block).
- Same IPPIS/mismatch edge cases as 4b apply here too.

**Cross-cutting edge case for all three branches:** verification service downtime — the whole flow depends on external verification (Remita/IPPIS/Dedukt rails). Need a graceful degraded state: "we're verifying this, we'll notify you" rather than a hard failure, since these are third-party rails Princeps doesn't control.

---

## Step 5 — Eligibility Calculation

**Flow:** Run scoring engine → eligible amount, 12-month tenor, shown across job-type-matched products.

**Edge cases:**
- **Score below minimum threshold:** no eligible products. Don't show an empty state — explain why (e.g., income too low relative to request, insufficient tenure) in plain language, and give a next step (try again in X months, contact support) rather than a dead end.
- **Borderline / manual review tier:** the ported Caltos scorer currently returns a binary `approved` / `declined` — there is no built-in borderline band. If the self-service portal needs a "we need a bit more time" holding state for scores just below the approval cutoff, that's a **new** tier to add on top of `scoreEligibility` (e.g., wrap the result and route scores in a defined range to manual review). Decide the range with risk before wiring it in — don't silently auto-approve or silently decline borderline cases.
- **Cross-product exposure:** existing customer already has an active loan on another product — must factor into eligible amount (reduced exposure room), and if it fully blocks a product, say so explicitly rather than just not showing that product with no explanation.
- **NYSC/corper months-remaining cap:** for corpers, eligible amount and tenor are capped by months remaining in service — tenor offered must never exceed their service end date.
- Scoring service unavailable — don't let users sit on a spinner indefinitely; show a retry or "come back shortly" state.
- All eligible amounts must display consistently formatted (see Design System money-display component) — this is the single highest-trust-risk moment in the flow.

---

## Step 6 — Offer Display (Multi-Product)

**Flow:** Show eligible amount, interest rate, monthly repayment, tenor across all products the job-type qualifies for.

**Edge cases:**
- Only one eligible product — layout must still look intentional, not like a broken grid missing two cards.
- Products with identical eligible amounts but different rates — make the *differentiator* (rate, fees, tenor flexibility) visually obvious, since "why are there three offers for the same amount" is a natural point of confusion.
- Product temporarily disabled/paused on the backend (deduction channel down, product paused) — must not appear as an option, or must clearly show why it's unavailable if partially shown.

---

## Step 7 — Product Selection → Full Terms

**Flow:** User selects one, sees full breakdown: fees, full repayment schedule, terms.

**Edge cases:**
- All fees must be shown before commitment — no fee should appear for the first time after "take offer" is clicked (NDPR/consumer-protection and trust risk).
- User can go back and pick a different product without re-running the whole eligibility step from scratch.

---

## Step 8 — Take Offer → Full Profile Collection

**Flow:** Full name, address, relationship status collected here (post-offer, not upfront). Religion optional, framed as "help us personalize offers for you."

**Edge cases:**
- If this is a returning customer with profile data already on file, pre-fill and let them confirm/edit rather than re-enter from scratch.
- Address entry — decide free-text vs. structured (state/LGA dropdowns) up front; free-text address data is hard to use later for anything (verification, mailing).
- Optional religion field must not visually look mandatory (no red asterisk, no blocking "continue").

---

## Step 9 — BVN Capture & Verification

**Flow:** Collect BVN, verify.

**Edge cases:**
- BVN format validation (11 digits) before submission, not after a failed verification round-trip.
- BVN verification fails: distinguish "BVN doesn't exist / typo" from "name on BVN doesn't match name on profile" — these need different user-facing messages and different resolution paths (retry vs. contact support).
- BVN belongs to someone with an existing internal profile (cross-product exposure check) — must reconcile with the phone/email-based customer match from Step 1a. If BVN reveals they're already a customer under a different phone/email, that's a fraud/dedup signal worth flagging to risk, not silently merging.

---

## Step 10 — Document Upload

**Flow:** Upload required documents for the selected loan product.

**Edge cases:**
- File size/type limits — mobile users will photograph documents; enforce reasonable compression/limits without silently rejecting large images.
- Upload fails on poor connection (a real constraint for this user base) — must support retry without re-uploading already-succeeded files, and should not force the user back to Step 1.
- Blurry/unreadable document — decide if this is caught automatically (needs OCR/quality check) or only caught at manual review; if the latter, be honest that "submitted" doesn't mean "accepted."
- User can save and return later mid-upload — session/progress persistence matters most right here, since documents are the highest-effort step.

---

## Step 11 — Submission & Status

**Flow:** Final submission, then a status state (approved / manual review / declined / disbursed pending).

**Edge cases:**
- Manual review state: give a realistic timeframe, and a way to check back (SMS/email notification when it changes, not just "check the app").
- Declined: give a reason where possible (regulatory/consumer trust) without over-explaining scoring internals.
- Disbursement pending on deduction channel setup (e.g., Standing Order requiring physical bank authorization) — this is a known Nigerian-market constraint; the status screen must explain this isn't instant and what the customer needs to do (visit their bank), not leave them thinking the app is broken.

---

## Cross-Cutting Edge Cases (apply everywhere)

- **Session/progress persistence:** this is a long multi-step flow on mobile, often on unstable connections. Save progress at every step boundary so a dropped connection or closed tab doesn't force a restart from Step 0.
- **Back navigation:** must never silently discard already-verified data (OTP, BVN, uploaded docs).
- **Duplicate submissions:** prevent double-application if user double-taps submit or resumes an already-submitted session.
- **Timeout/session expiry:** define how long an incomplete application stays valid before requiring restart, and message this clearly rather than silently expiring.
- **Accessibility on low-literacy/low-tech-familiarity users:** every irreversible action (submit, take offer) needs a plain-language confirmation, not just a button.
- **Language + RTL/text-length:** already covered in Step 0, but re-verify at every step with real Yoruba/Igbo/Hausa strings, not lorem-ipsum-length placeholders, since financial terms often run longer than their English equivalents.

---

## Architecture Note (carry into build)

No live backend exists yet for Caltos's eligibility/product logic — it currently runs in-browser only. Build this portal against a clearly separated service layer (API client abstraction) so that:
1. Short-term: it can run against mocked/local eligibility logic (ported from Caltos's `eligibility-scoring.ts`) to unblock frontend work.
2. Long-term: swapping in a real backend endpoint is a config/interface change, not a rewrite.

Do not let the eligibility scoring rules diverge between this repo and Caltos — treat Caltos's scorer as the single source of truth and port it deliberately, not reimplement it from memory of the rules.
