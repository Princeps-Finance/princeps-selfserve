# Princeps Self-Serve — Product Requirements

| | |
| --- | --- |
| **Document version** | 1.0.0 (draft for review) |
| **Status** | Draft. Not yet approved by Engineering or Compliance |
| **Owner** | Product (CPO) |
| **Last updated** | 2026-11-09 |
| **Applies to** | Princeps Self-Serve (web app, to be shipped as a PWA) |
| **Related** | `FLOW-SPEC.md` (step-level edge cases), `DESIGN-SYSTEM.md`, `ACCESSIBILITY.md`, `SECURITY.md` |

How to read this: sections 1–4 say *what and why*. Sections 5–9 say *how the
product behaves*. Sections 10–13 cover *versioning, rules, gaps and open
questions*. Anything marked **Decision** is settled; **Proposal** needs sign-off.

---

## 1. Summary

Princeps Self-Serve lets a Princeps customer **apply for a loan by themselves**, on
their phone, in their own language, without an agent or a branch visit.

It owns one outcome: **a complete, correct loan application, submitted to Caltos
with no friction and no dead ends.** Caltos owns everything after that.

### Goals
1. A customer can finish an application unaided on a mid-range Android phone and
   a weak connection.
2. Every step, error and confirmation is clear in English, Yoruba, Igbo and Hausa.
3. The customer never feels stuck: they always know where they are, what to do
   next, and what happens if something fails.
4. Product rules live in Caltos. Self-Serve adapts to them without a code release.
5. A customer who stops can come back and continue where they left off.

### Non-goals (this version)
- Processing, approving or disbursing loans (Caltos).
- Repayments, loan documents, statements, loan servicing (Caltos customer module).
- Viewing or editing customer records on the Princeps Console. Customer details on
  the Console are wanted later, and are **out of scope now**. See section 13.
- Replacing agents or branches. They remain the fallback for any customer who
  needs a person.

## 2. Users

Princeps customers across Nigeria, many on entry- to mid-range Android phones,
on weak or expensive data, with a wide range of literacy and English fluency.

Segments today: federal and state civil servants, paramilitary staff, NYSC corpers.
Segments planned: pensioners, private sector, self-employed. Which segment can
apply is decided by the loan products configured in Caltos (section 4), not by
the app.

**Language is a core requirement.** English, Yoruba, Igbo and Hausa must each be
complete and natural. A read-aloud option supports lower-literacy customers. Never
show English-only text, an untranslated key, or a message a customer cannot act
on. See section 8.

## 3. Principles

1. **Caltos is the source of truth.** Products, eligibility, mandate rules and
   required documents come from Caltos. Self-Serve does not hard-code business rules.
2. **Show only what matters.** For a product, show name, amount, tenor, interest
   rate and interest type. Nothing the product does not define.
3. **Never leave the customer stuck.** Every failure has a clear next action and a
   human fallback.
4. **Never fake an outcome.** No approval, verification or success the system did
   not actually produce.
5. **The server decides.** The browser collects and displays. Caltos confirms.
6. **Minimal sensitive data.** Collect only what the product requires. Clear it when
   no longer needed.
7. **Light and accessible.** Works at 320px, with keyboard and screen readers, on
   slow networks.

## 4. System boundaries

| System | Owns | Self-Serve's relationship |
| --- | --- | --- |
| **Self-Serve** | The application experience: language, steps, validation, saving progress, submission | This product |
| **Caltos** | Loan products and their settings, eligibility calculation, application intake, documents and video, mandate setup, loan processing, approval, disbursement | Self-Serve reads from it and submits to it. There is no separate "backoffice" |
| **Caltos customer module** | Tracking, repayments, loan documents, statements | Self-Serve hands the customer over after submission |
| **Princeps Console** | Internal view of customer details | Not integrated now. Later |

**Decision:** Self-Serve submits to Caltos. Developers will connect Caltos
endpoints for products, eligibility, application intake and the rest. The
capabilities Self-Serve needs from Caltos are listed in section 9.3.

## 5. Product configuration (what Caltos decides)

Princeps creates loan products in Caltos. Each product carries settings that
Self-Serve must follow. The app builds the journey from these settings.

| Caltos setting | What it controls in Self-Serve |
| --- | --- |
| **Eligibility type** | Who is shown the product: salary processing partner (WACS or Remita), gender (some products are women-only or men-only), corper, pensioner, and similar |
| **Display fields** | Product name, amount, tenor, interest rate, interest type. These are the only commercial fields shown on the offer |
| **Mandate setup** | Which mandate applies and how it is completed. **This is where a link may be generated**, if the product is set up that way (see 6.6) |
| **Identity video** | Whether a video is required: customer **records on the site**, **uploads / uses a generated link**, or **chooses between both** |
| **Required documents** | Which documents the customer must provide |
| **Eligibility rules** | Calculated in the background from the verified details (section 6.5) |

**Decision:** the number and order of steps can differ per customer, because the
matched product changes what is needed. The app must not assume a fixed list.

**Proposal:** treat a product's settings as a versioned configuration. The
application records which product configuration version the customer applied
against (section 10).

## 6. The journey

### 6.1 Stages

The customer moves through these stages. Steps inside a stage appear only when the
matched product needs them.

| # | Stage | What happens |
| --- | --- | --- |
| 1 | **Language** | Choose English, Yoruba, Igbo or Hausa. Remembered. Switching mid-flow keeps everything entered |
| 2 | **Contact and phone check** | Phone, email, OTP. A returning customer is recognised |
| 3 | **Resume** (only if a saved application exists) | See section 7 |
| 4 | **Bio data** | Name, date of birth, address, relationship status, and the identity checks required (BVN, NIN) |
| 5 | **Employment** | Employment type, employer, salary processing partner, salary account, IPPIS number where relevant. This places the customer in the right eligibility group |
| 6 | **Eligibility** | Calculated in the background. The customer sees a result, never a score |
| 7 | **Product match** | Only matching products: name, amount, tenor, interest rate, interest type. Customer picks one |
| 8 | **Terms** | Full terms and repayment schedule for the chosen product. Customer accepts |
| 9 | **Mandate** | Set up as the product defines. May involve a generated link (6.6) |
| 10 | **Documents and identity confirmation** | As the product requires, including the video option. Part of the application and sent to Caltos |
| 11 | **Review and submit** | Customer reviews and submits to Caltos |
| 12 | **Success and track** | Confirmation and a path to track the loan (6.7) |

Customers who cannot apply yet (a segment that is not live) join a **waitlist**
with a clear message, never a dead end.

### 6.2 Bio data and employment
Bio data and employment are separate screens. Together they determine eligibility.
Where Caltos can confirm details (for example BVN or NIN), prefill and let the
customer correct, rather than retyping.

### 6.3 Documents and identity are part of the application
Documents and the identity video are **not a side step**. They are submitted to
Caltos as part of the same application. If a customer has uploaded them and then
stops, they must still be there when the customer resumes.

### 6.4 Identity video
Configured per product (section 5):
- **Record on the site:** the customer says the required details on camera.
- **Upload or link:** the customer provides a video another way.
- **Both:** the customer chooses.

If the camera or microphone fails, offer the other option when the product allows
it, and a human fallback when it does not.

### 6.5 Eligibility
Calculated in the background from verified details, using Caltos rules.
- The customer is never asked to understand a score.
- A positive result leads to matching products.
- A negative result is explained plainly and offers a next step: another product,
  the waitlist, or an agent.

### 6.6 Mandate and generated links
The mandate step follows the product. **If the product is set up for it, the mandate
step generates a link** the customer uses to complete the mandate. The app must:
- Show clearly what the link is for and what the customer must do.
- Show waiting, completed and failed states for the mandate.
- Let the customer return later, and show an up-to-date state when they do.
- Not let the customer submit until the mandate is in the state the product requires.

### 6.7 After submit
1. Show a **success screen**: application received, a reference number, what happens
   next, and expected timing.
2. Show a primary button: **Track your loan**.
3. The button takes the customer to the **Caltos customer module**, where they
   track status, repay and get their loan documents.
4. Self-Serve does not show loan status itself and does not promise an outcome
   (approval, disbursement) it does not know.

**Open:** how the customer arrives in the customer module without logging in
twice (section 13, question 5).

## 7. Resume: continue where you stopped

**Decision:** application progress is saved. A customer who stops can resume.

### 7.1 What to show: a dedicated "Welcome back" step, not a modal

You asked which UX is best. **Recommendation: after OTP, show a full-screen
"Welcome back" step, with one clear primary action.**

| Option | Verdict |
| --- | --- |
| Silently jump to the last step | Rejected. Disorienting, and the customer may want to correct something |
| Modal over the next screen | Rejected. Easy to dismiss by accident, awkward on small screens, focus and screen-reader handling is harder, and it hides what is being resumed |
| **Dedicated step after OTP** | **Recommended.** Calm, translatable, accessible, shows what was saved |

The step shows:
- A friendly line: "Welcome back. You have an application in progress."
- What is saved: the product and amount if chosen, the step reached, and when
  (for example "Last saved yesterday").
- **Primary:** *Continue from [step name]*.
- **Secondary:** *Start over*, with a confirmation that says what will be deleted.
- A way to reach help.

Why after OTP: the saved application contains personal data, so resuming is shown
only after the phone number is verified. It also puts resume exactly where a
returning customer already is in the journey.

### 7.2 Where the draft is stored

**Proposal:** store the draft **server-side, keyed to the verified phone number**,
not only on the device. This lets a customer continue on another phone and avoids
sensitive data sitting in browser storage.
- The device keeps only a non-sensitive pointer (for example that a draft exists).
- Sensitive fields (BVN, NIN, account number) live only on the server.
- Uploaded documents and video are stored in Caltos as they are uploaded, and the
  draft references them.

This needs a draft capability from Caltos or a Princeps service (section 13, question 3).

### 7.3 Rules for resuming
- **Save as they go.** Save at the end of each step, not only at the end.
- **Draft lifetime:** *proposal* 14 days of inactivity, then expire with a clear
  message and an easy restart.
- **Re-check what can go stale.** On resume, re-run eligibility and re-fetch the
  matching product if the draft is older than a threshold or the product
  configuration version changed. Tell the customer if the offer changed.
- **Terms:** if the terms version changed since acceptance, ask the customer to
  accept again.
- **OTP:** an OTP is never reused. The customer verifies again to resume.
- **Language:** resume in the language the customer last used, switchable.
- **Mandate:** if a link was generated and is pending, resume to the waiting or
  completed state, not to a blank mandate step.
- **App updates:** a draft saved by an older app version is migrated or, if that
  is not possible, the customer is told clearly and the safe parts are kept
  (section 10.2).
- **One active application per customer** unless the business decides otherwise
  (question 4).

## 8. Language

This is a product requirement, not polish.

- All four languages cover **every** screen, field label, validation message, error,
  confirmation, and the read-aloud text.
- A missing translation falls back to English silently, never shows a key, and is
  logged so it gets fixed.
- Translations are reviewed by native speakers before release. Machine or
  engineer-written translations are drafts until reviewed.
- Money, dates and phone numbers format consistently regardless of language.
- Terms, mandate and consent text exist in all four languages. The version and
  language the customer accepted are recorded with the application.
- Layout allows for longer text in any language. No clipped or overflowing labels.
- Read-aloud is available on every screen and works in all four languages, with a
  clear message when a device lacks a voice for a language.

## 9. Integration and system behaviour

### 9.1 Submission
On submit, the full application goes to Caltos: bio data, employment, the chosen
product and its configuration version, the eligibility result, mandate state,
documents, identity video, accepted terms and language, and the app version.

### 9.2 Failure behaviour
- If submission fails, the customer is told it did **not** go through, keeps their
  progress, and can retry. Never show a false success.
- Duplicate submissions are prevented. A retry after a timeout must not create two
  applications (idempotent submission).
- If Caltos is unavailable, say so plainly and save the draft.

### 9.3 What Self-Serve needs from Caltos
Developers will connect these. This is a list of capabilities, not final endpoint
names.

| Capability | Used for |
| --- | --- |
| Customer lookup by verified phone | Returning customer, existing active loans |
| List products matching a customer | Product match, with display fields |
| Product settings | Mandate type, video option, required documents, configuration version |
| Eligibility calculation | Background eligibility result and reasons |
| Create and update draft application | Resume (section 7) |
| Create application (submit) | Final submission, idempotent, returns a reference |
| Upload document and upload identity video | Part of the application |
| Generate mandate link and read mandate status | Mandate step |
| Customer hand-off to customer module | "Track your loan" button |

Identity and bank checks (OTP, BVN, NIN, salary account) are also needed, whether
they come from Caltos or a partner. Who provides each is an open question.

## 10. Versioning

You asked for this to be versioned even though it is a PWA. A PWA changes how
versioning has to work: users run **old copies of the app that keep working
offline and update in the background**. So versioning has to cover several things.

### 10.1 What is versioned

| Thing | Scheme | Why |
| --- | --- | --- |
| **This document** | Semantic: MAJOR.MINOR.PATCH, with a changelog at the end | MAJOR when a journey or rule changes, MINOR when a capability is added, PATCH for clarifications |
| **App release** | Semantic version stamped into the build and shown in the app footer or help panel | Support can ask "which version are you on?" |
| **Application schema** | Integer, in every saved draft and every submission | Lets old drafts be migrated or rejected safely |
| **API contract with Caltos** | Version in the path (for example `/v1`) | Backend and app can change independently |
| **Product configuration** | Version from Caltos on each product | Know which rules a customer applied under, and detect change on resume |
| **Terms, mandate and consent text** | Version per document, per language | Legal record of exactly what was accepted |
| **Translations** | Released with the app, with a content version | Know what text a customer saw |

Each submission records: app version, schema version, product configuration
version, terms version, and language.

### 10.2 PWA update behaviour
**Today the app is not yet a PWA.** It has no manifest or service worker. Making it
one is a separate piece of work, and these rules apply when it is built.

- **Never interrupt a customer mid-step with a forced reload.** Updates apply at a
  safe point: after submit, on returning to the start, or when the customer
  taps "Update".
- Show a calm, translated "A new version is ready" notice. Never lose entered data.
- **Minimum supported version:** the server can mark an old version as too old
  (for example after a security or pricing fix). Such a client is asked to update
  before it can submit.
- Submission is always checked by the server, so an old cached app can never bypass
  current rules.
- Offline support is for resilience (reopening the app, keeping the draft), **not**
  for submitting offline. Submitting needs a connection and says so.
- Drafts survive updates through the schema version and migrations.
- Release notes are kept for every release, with the doc changelog for product
  changes.

## 11. Success

> **A customer can apply for a loan successfully, with no issues. Happy and unhappy
> paths are clear, and the customer never feels stuck.**

### 11.1 What "never stuck" means
At every step the customer can answer three questions: *Where am I? What do I do
next? What happens if this goes wrong?*

### 11.2 Measures (Proposal, targets to be set with data)
| Measure | Why |
| --- | --- |
| Application completion rate | Primary outcome |
| Drop-off by step and by language | Find where customers get stuck |
| Time from first tap to submit | Speed and friction |
| Resume rate and resume completion rate | Is saving progress working |
| Error rate by type (OTP, BVN, NIN, salary, submit) | Find unhappy paths that fail |
| Support contact rate during application | Customers who needed help |
| Submission failure and retry rate | Reliability of the Caltos link |

Targets are not set yet. Capture a baseline first.

### 11.3 Unhappy paths
Each needs a clear, translated, actionable message.

- Wrong or expired OTP, too many attempts: what to do and when to retry.
- BVN or NIN not found, or name mismatch: fix it or get help.
- Salary account not found, or name mismatch: fix it or get help.
- Not eligible, or no product matches: say so plainly, offer a next step.
- Product or offer changed while the customer was away: explain and show the new offer.
- Mandate link not completed or failed: explain, offer retry or help.
- Camera, microphone or upload problem: offer the other video option or help.
- Network loss: reassure, keep progress, allow retry.
- Caltos or a partner is down: say it is not the customer's fault, keep progress.
- Anything else: always a way to reach a person (agent line, WhatsApp, office).

Rules for every message: say what happened, say what to do next, never blame the
customer, never show a raw error or key, always offer help.

## 12. Non-negotiables

- CBN-licensed, NDPR-compliant, data kept in Nigeria, clear complaint route,
  regulatory text always visible.
- BVN, NIN, bank details, face and video are never logged and are handled minimally.
- Content-Security-Policy and security headers on the app. Server-side validation
  of everything submitted.
- Accessibility to WCAG AA, tested with keyboard and screen readers.
- No hard-coded product rules in the app once Caltos provides them.

## 13. Gaps between this vision and the code, and open questions

### 13.1 Gaps (code today vs this document)

| This document | Code today |
| --- | --- |
| Products come from Caltos, matched per customer | Four products hard-coded in `src/shared/pricing.ts` |
| Eligibility by partner (WACS, Remita), gender, corper, pensioner | Matched on employment type and channel (`ippis`, `remita`, `dedukt`) only |
| Eligibility calculated in the background by Caltos | Calculated in the browser |
| Mandate follows product settings, including generated links | Mandate channel derived from employment type; no link flow |
| Video option per product (record, upload/link, both) | One fixed record-on-site step |
| Required documents per product | One fixed document list |
| Steps vary by product | Fixed 14-step journey |
| Documents and video are sent to Caltos as part of the application | Only file names and sizes are sent; video is kept in memory |
| Progress is saved and resumable after OTP | Progress lives in memory only and is lost on refresh |
| Submits to Caltos | Code and the integration contract call the target a "backoffice"; rename and repoint to Caltos |
| Success screen with "Track your loan" to the customer module | Status page shows a simulated or interim outcome and no hand-off |
| Versioning, drafts and PWA update behaviour | None. Not yet a PWA |
| Pensioners, private sector, self-employed | "Coming soon" or absent |

### 13.2 Open questions

1. **Caltos API:** which team owns it, and which of the capabilities in 9.3 exist
   today? What authentication does Self-Serve use?
2. **Identity and bank checks:** who provides OTP, BVN, NIN and salary account
   verification: Caltos or direct partners?
3. **Drafts:** can Caltos store draft applications, or does Self-Serve need its own
   small service? (This is also where the Princeps Console could later read from.)
4. **One active application:** may a customer have more than one application or
   loan at once, across products? What is the rule?
5. **Customer module access:** how does "Track your loan" log the customer in
   without a second login (shared session, one-time link, or sign-in)?
6. **Mandate link:** what does the link open, who hosts it, and how does Caltos tell
   Self-Serve the mandate is complete (callback, polling)?
7. **Eligibility timing:** is the background calculation instant or asynchronous?
   If it can take time, what does the customer see while waiting?
8. **Returning customers:** which saved details can be reused, and what is the rule
   for a customer who was previously declined?
9. **Gender-restricted products:** where does gender come from (BVN, bio data,
   Caltos) and how is it asked without confusion?
10. **Draft lifetime and data retention:** is 14 days right, and what does
    compliance require?
11. **Translations:** who is the native reviewer for each language, and how do
    approvals get recorded?
12. **Princeps Console (later):** which customer details does Console need, and from
    which moment (draft, submitted, both)?

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-11-09 | First full version. Caltos is the source of truth and submission target. Added resume, mandate links, documents and video as part of the application, success and tracking hand-off, versioning and PWA update rules, measures, gaps and open questions |
| 0.1.0 | 2026-11-09 | Initial draft from the product owner's description |
