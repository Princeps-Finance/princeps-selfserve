# Princeps Self-Serve — Product Requirements

| | |
| --- | --- |
| **Document version** | 1.1.0 (draft for review) |
| **Status** | Draft. Not yet approved by Engineering or Compliance |
| **Owner** | Product (CPO) |
| **Last updated** | 2026-11-09 |
| **Applies to** | Princeps Self-Serve (web app, to be shipped as a PWA) |
| **Related** | `FLOW-SPEC.md` (step-level edge cases), `DESIGN-SYSTEM.md`, `ACCESSIBILITY.md`, `SECURITY.md` |

How to read this: sections 1–4 say *what and why*. Sections 5–9 say *how the
product behaves*. Sections 10–13 cover *versioning, success, rules, gaps and what
still needs a decision*. Anything marked **Decision** is settled; **Proposal** needs sign-off.

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

Because the product is fetched fresh each time (section 6.5), a customer always
applies against the current product settings.

## 6. The journey

### 6.1 Stages

The customer moves through these stages. Steps inside a stage appear only when the
matched product needs them.

| # | Stage | What happens |
| --- | --- | --- |
| 1 | **Language** | Choose English, Yoruba, Igbo or Hausa. Remembered. Switching mid-flow keeps everything entered |
| 2 | **Contact and phone check** | Phone, email, OTP. A returning customer is recognised |
| 3 | **Resume** (only if a saved application exists on this device) | See section 7. Eligibility always re-runs before the customer continues |
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
Caltos as part of the same application. Caltos receives
nothing until the customer submits, so until then the files are held on the
customer's device (section 7). If a customer has uploaded them and then stops, they
must still be there when the customer resumes.

### 6.4 Identity video
Configured per product (section 5):
- **Record on the site:** the customer says the required details on camera.
- **Upload or link:** the customer provides a video another way.
- **Both:** the customer chooses.

The video typically includes the loan amount and repayment, so it is only valid for
the offer it describes. If the offer changes (for example after resume), the customer
records again.

If the camera or microphone fails, offer the other option when the product allows
it, and a human fallback when it does not.

### 6.5 Eligibility
Calculated in the background by Caltos from verified details.

**Decision: eligibility always runs.** It runs when the customer first reaches it,
**and again every time a customer resumes a saved application**, before they are
taken back to where they stopped. Eligibility is never trusted from an earlier
session, because the customer's situation, the rules or the products may have
changed.

- The customer is never asked to understand a score.
- A positive result leads to the matching products, fetched fresh.
- A negative result is explained plainly and offers a next step: another product,
  the waitlist, or an agent.
- While it runs, show a short, translated "Checking your options…" state.

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

**Decision:** application progress is saved, and a customer who stops can resume.

**Why Self-Serve saves it:** Caltos only receives an application at submission. It
holds no drafts. So Self-Serve is responsible for keeping progress until then.

**Decision (version 1): the draft is saved on the customer's device**, inside the
PWA, and is tied to the verified phone number. Resume works on the same device and
browser. A customer who changes phone starts again; details Caltos already holds for
a returning customer reduce the retyping. Cross-device resume would need a
Self-Serve-owned draft service and is a later step (section 13).

### 7.1 What the customer sees: a "Welcome back" step, not a modal

After the customer verifies their OTP, if a saved application exists, show a
**full-screen "Welcome back" step** with one clear primary action.

| Option | Verdict |
| --- | --- |
| Silently jump to the last step | Rejected. Disorienting, and the customer may want to correct something |
| Modal over the next screen | Rejected. Easy to dismiss by accident, awkward on small screens, harder for screen readers, and hides what is being resumed |
| **Dedicated step after OTP** | **Chosen.** Calm, translatable, accessible, shows what was saved |

The step shows:
- A friendly line: "Welcome back. You have an application in progress."
- What is saved: the product and amount if chosen, the step reached, and when
  (for example "Last saved yesterday").
- **Primary:** *Continue from [step name]*.
- **Secondary:** *Start over*, with a confirmation saying exactly what will be deleted.
- A way to reach help.

It appears only after OTP, because the saved application contains personal data and
must not be shown before the phone number is verified.

### 7.2 What happens when they tap Continue

1. Show "Checking your options…" and **run eligibility again** (section 6.5).
2. Fetch the matching products again.
3. Then one of three things happens:
   - **Same result, same product terms:** take the customer to the step they stopped at.
   - **Something changed** (eligibility, amount, rate, tenor, mandate, required
     documents or video): tell the customer plainly what changed, keep every answer
     they gave, and take them to the first step affected. If the offer changed, any
     recorded identity video is discarded and recorded again.
   - **No longer eligible:** explain plainly and offer a next step (another product,
     the waitlist or an agent). Their saved answers are kept until the draft expires.

Identity and bank verification results are kept in the draft. They are repeated only
if the customer edits those details, or Caltos rejects them during the eligibility
check.

### 7.3 What is saved

| Saved on the device | Never saved |
| --- | --- |
| Answers to every completed step (bio data, employment, salary account, BVN, NIN) | OTP codes |
| The step reached, the language, and when it was saved | Eligibility results, product lists and offers (always re-fetched) |
| The product the customer chose | |
| Documents and the identity video, held until submission | |
| Mandate link state, if one was generated | |
| The web app version that wrote the draft | |

BVN, NIN and the account number are needed at submission, so they must be kept in the
draft. See protections below.

### 7.4 Rules

- **Save as they go.** Save at the end of each step, not only at the end.
- **Draft lifetime: 7 days of inactivity**, then delete it and say so. Some mobile
  browsers clear site storage after about a week of non-use for sites that are not
  installed, so installing the PWA also makes saved progress more reliable.
- **Cleared on submit and on "Start over".** Nothing sensitive stays on the device
  after a successful submission.
- **Terms:** if the terms text changed since the customer accepted, ask them to
  accept again.
- **Mandate link:** if a link was generated and is pending, resume to the waiting or
  completed state, not to a blank mandate step.
- **Language:** resume in the language last used, switchable.
- **One draft per verified phone number on a device.**
- **App updates:** the draft records the app version. When a release changes the
  shape of a draft, the app migrates it. If it cannot, the customer is told clearly
  and the parts that are safe to keep are kept (section 10).

### 7.5 Protections for data kept on the device

- Resume is possible only after OTP verification of the **same phone number**.
- Sensitive values are masked on screen and never written to logs or analytics.
- The draft is deleted on expiry, on submit and on "Start over".
- The customer is told, in plain language, that progress is saved on this device and
  how to delete it. This matters on a shared phone.
- **Proposal:** encrypt the draft at rest with a key held by the browser, as defence
  in depth. This does not stop a script running in the page, so it does not replace
  the other protections.
- **Needs Compliance sign-off (NDPR):** keeping BVN, NIN and the account number on
  the device until submission. If it is not approved, the fallback is to leave those
  out of the draft and ask the customer to enter and verify them again on resume.

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
The application reaches Caltos **only at submission**. Until then it lives on the
customer's device (section 7). On submit, the full application goes to Caltos: bio
data, employment, the chosen product, the eligibility result, mandate state,
documents, identity video, accepted terms and language, and the web app version.

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
| Create application (submit) | Final submission, idempotent, returns a reference |
| Upload document and upload identity video | Part of the application |
| Generate mandate link and read mandate status | Mandate step |
| Customer hand-off to customer module | "Track your loan" button |

Identity and bank checks (OTP, BVN, NIN, salary account) are also needed, whether
they come from Caltos or a partner. Who provides each is an open question.

## 10. Versioning

**Versioning is based on the web app.** Self-Serve ships as one PWA, with one
semantic version: MAJOR.MINOR.PATCH.

| Change | Bump |
| --- | --- |
| A change to the journey, a rule, or anything that alters a saved draft | MAJOR or MINOR |
| A new capability or screen | MINOR |
| A fix or a text correction | PATCH |

That one version covers the code, the translations, and the terms, mandate and
consent text, because they ship together inside the app.

- The version is built into the app and shown in the help panel, so support can ask
  "which version are you on?"
- **Every submission records the web app version** and the language and terms the
  customer saw.
- **Every saved draft records the web app version** that wrote it, so a newer
  version can migrate it.
- This document has its own version. It tracks product decisions, not releases.
  Release notes name the document version they implement.
- Product rules and prices come from Caltos at the time of use, so they are not part
  of the app version.

### 10.1 PWA behaviour

Customers keep running an old copy of the app until it updates in the background.
So:

- **Never reload a customer mid-step.** A new version is applied at a safe point:
  after submit, on the start screen, or when the customer taps "Update". A calm,
  translated notice says a new version is ready.
- Entered data is never lost by an update.
- **Minimum supported version:** the server can mark an old version as too old (for
  example after a security or pricing fix). That version must update before it can
  submit.
- Caltos always checks the submission, so an old cached app can never bypass current
  rules.
- **Offline is for resilience**: reopening the app, keeping the draft, showing a clear
  "you're offline" message. **Submitting needs a connection** and says so.
- Installable on the home screen with the Princeps name, icon and colours.

**Built:** the app has a web manifest and a service worker (installable, caches the
app for fast and offline reopening, and detects new versions). See the changelog.

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
| Share of resumes that need changes after eligibility re-runs | How often offers change under customers |
| PWA installs and share of sessions on the latest version | Is the app updating properly |
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
| Eligibility calculated in the background by Caltos, always re-run on resume | Calculated in the browser |
| Mandate follows product settings, including generated links | Mandate channel derived from employment type; no link flow |
| Video option per product (record, upload/link, both) | One fixed record-on-site step |
| Required documents per product | One fixed document list |
| Steps vary by product | Fixed 14-step journey |
| Documents and video are sent to Caltos with the application | Only file names and sizes are sent; video is kept in memory |
| Progress saved on the device and resumable after OTP | Progress lives in memory only and is lost on refresh |
| Submits to Caltos | Code and the integration contract call the target a "backoffice"; rename and repoint to Caltos |
| Success screen with "Track your loan" to the customer module | Status page shows an interim outcome and no hand-off |
| One web app version, shown in help and sent on submit | Added with the PWA work; not yet sent on submit |
| Pensioners, private sector, self-employed | "Coming soon" or absent |

### 13.2 Decisions made in this version (please confirm)

These came from your answers. Tell me if any is wrong.

1. **Caltos holds no drafts**, so progress is saved by Self-Serve on the device, in
   version 1. Cross-device resume is later.
2. **Eligibility always re-runs on resume**, before the customer continues, and
   again at product match.
3. **Draft lifetime is 7 days.**
4. **Identity and bank verification are not repeated on resume** unless the
   customer edits those details or Caltos rejects them.
5. **The identity video is re-recorded if the offer changes**, because it states the
   amount.
6. **Versioning follows the web app**, as one semantic version.

### 13.3 Still needs a product decision

Your answers did not cover these.

1. **More than one application or loan at a time.** May a customer have more than
   one active application or loan across products, and what does Caltos allow?
2. **Previously declined customers.** Show their history, or let them apply fresh?
3. **Gender-restricted products.** Where does gender come from (BVN, bio data, Caltos),
   and how do we ask for it without confusion?
4. **Native reviewers.** Who reviews and signs off Yoruba, Igbo and Hausa, and how is
   the approval recorded?
5. **Compliance.** Is keeping BVN, NIN and the account number on the device until
   submission acceptable under NDPR (section 7.5)?

### 13.4 Integration details for the Caltos developers

These are engineering details to settle while connecting the endpoints. They are not
product decisions.

- How Self-Serve authenticates to Caltos.
- Who provides OTP, BVN, NIN and salary-account verification: Caltos or direct
  partners.
- How "Track your loan" signs the customer in to the customer module without a second
  login.
- How Self-Serve learns a mandate link was completed (callback or polling).
- Idempotent submission, so a retry cannot create two applications.
- Whether eligibility is instant or asynchronous, and what the customer sees while
  waiting.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.1.0 | 2026-11-09 | Versioning is now based on the single web app version. Eligibility always re-runs on resume. Caltos holds no drafts, so progress is saved on the device in v1 (cross-device later). Added PWA manifest and service worker. Replaced the open-questions list with confirmed decisions, five remaining product decisions, and a separate list of integration details for developers |
| 1.0.0 | 2026-11-09 | First full version. Caltos is the source of truth and submission target. Added resume, mandate links, documents and video as part of the application, success and tracking hand-off, versioning and PWA update rules, measures, gaps and open questions |
| 0.1.0 | 2026-11-09 | Initial draft from the product owner's description |
