# Princeps Self-Serve — Product Requirements

| | |
| --- | --- |
| **Document version** | 1.2.0 (draft for review) |
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
| **Display fields** | Product name, amount, tenor, interest rate, interest type, **monthly repayment, total repayable, fees and cost of credit**. The customer can change amount and tenor within the limits (6.4) |
| **Mandate setup** | Which mandate applies and how it is completed. **This is where a link may be generated**, if the product is set up that way (see 6.6) |
| **Identity video** | Whether a video is required: customer **records on the site**, **uploads / uses a generated link**, or **chooses between both** |
| **Required documents** | Which documents the customer must provide |
| **NIN** | Whether NIN is required. **Not every product needs it**, so the NIN step only appears when the chosen product asks for it |
| **Eligibility rules** | Calculated in the background from the verified details (section 6.5) |

**Decision:** the number and order of steps can differ per customer, because the
matched product changes what is needed. The app must not assume a fixed list.

Because the product is fetched fresh each time (section 6.5), a customer always
applies against the current product settings.

## 6. The journey

Our own application format for public servants: **get their bio data and work details, check what they can get,
then ask for the extra details needed for loan documentation.** The customer sees their offer *before* they are asked
for ID documents, a selfie, a video or a mandate. This is deliberate: effort comes after the reward.

### 6.1 Stages

| # | Stage | What happens |
| --- | --- | --- |
| 0 | **Language, then intent** | Choose English, Yoruba, Igbo or Hausa. Then choose **Take a loan now** or **See how much I can get**. Both use the same journey; the second ends with a "come back any time" screen after the offer instead of continuing |
| 1 | **Get started** | Phone, email, **consent to the Privacy Notice**, then OTP. Nothing about the customer is looked up before the OTP |
| | *Resume* | If this device has a saved application for this number, show **Welcome back** (section 7). Returning customers see a summary |
| 2 | **Your details** | Bio data (name, date of birth, address, relationship status). Work details (employment type, salary processing partner, salary account, IPPIS number). The salary account is verified against the name given |
| 3 | **Your offer** | Eligibility runs in the background, then the matching products are shown with an editable amount and tenor (6.4). Terms and repayment schedule follow once the customer picks one |
| 4 | **Loan documentation** | BVN (name and date of birth must match), NIN **only if the product needs it**, documents, a **selfie holding the ID and a video** (6.5), and the **mandate** (6.6) |
| 5 | **Review and submit** | Customer reviews and submits to Caltos |
| 6 | **Received** | Success screen with reference, what happens next, and **Track your loan** (6.8) |

The progress bar shows four stages (Get started, Your details, Your offer, Loan documentation), not "step n of 14",
because the number of steps differs by product and customer.

Customers who cannot apply yet (a segment that is not live) join a **waitlist**, never a dead end.

### 6.2 Bio data and work details
Collected first, in separate screens. Together with the verified salary they determine eligibility. BVN is **not**
used to prefill bio data (it comes later, and it is used to verify what the customer typed).

### 6.3 Documents and identity are part of the application
Documents, the selfie with ID and the video are submitted to Caltos with the application. Caltos receives nothing until
submission, so they are held in the customer's browser until then. They are **not** saved if the customer leaves
(section 7); they are captured again on return.

### 6.4 Offers: the customer chooses amount and tenor
Eligibility sets the **maximum**. The customer can then change both:
- **Amount:** type it, use the slider or the plus and minus buttons. It rounds to the product's step and stays between
  the product minimum and the most they are eligible for. Out-of-range entries are adjusted and the customer is told.
- **Tenor:** choose from the allowed months.
- **Live summary:** monthly repayment, total repayable, each fee, total fees and **cost of credit** update as they change
  either value. Rate, interest type and frequency are shown with the product.
- The starting point is the maximum, or what they chose last time if it still fits.
- If no product fits (eligible amount or tenor below every product minimum), say so and offer: update details, WhatsApp,
  call. Never an empty page.

### 6.5 Identity: selfie holding ID, and video
**Decision: keep the selfie holding the ID.** It is the best low-cost check that the person applying is the person on the
ID. It was previously asked twice (as a document and again as a face photo); it is now **one live camera capture** in
the identity step. Rules:
- **Camera only.** Photos from the gallery are not accepted, so an old or stolen photo cannot be reused.
- The face and the ID must both be clearly visible, in good light.
- **It only proves possession, not identity.** Someone holding a stolen ID can still pass. So Caltos or a partner must
  **match the face to the ID and BVN/NIN photo and run a liveness check**, with human review of mismatches (section 12).
- The **spoken video** states the loan amount and repayment, which is a strong control against coercion and fake
  applications. If the offer changes, the video is recorded again.
- Per product (section 5) the video is **recorded on the site, uploaded, or the customer chooses either**. If the camera
  fails and uploading is allowed, offer upload; otherwise offer WhatsApp help.

### 6.6 Mandate and generated links
The mandate step follows the product. If the product is set up for it, the step **creates a link** the customer uses to
complete the mandate with their bank or payroll provider. The app:
- Explains what the link is for and what to do.
- Shows waiting, completed and failed states, checks automatically while the page is open, and has a "check now" button.
- Lets the customer open or copy the link.
- Does not allow submission until the mandate is completed.
Otherwise the mandate is a tick-box authorisation.

### 6.7 Eligibility, decline and manual review
Calculated by Caltos in the background and **always re-run on resume** (section 7).
- **Approved:** show matching products.
- **Manual review band:** *not a dead end.* The customer still picks an offer and submits. They are told a person will
  review it and it may take longer; the application carries a review hint and Caltos decides.
- **Declined:** a plain, translated explanation of why (for example "NYSC service ends in 2 months; at least 3 are needed"),
  reassurance that it is not final, and next steps: update details, WhatsApp, call.
- **Known knock-outs are caught early.** A corper with too few months left is told at the work step, not after more
  screens.
Reasons are structured codes, translated in the app, never raw English.

### 6.8 After submit
1. A **success screen**: "Application received", a reference (with a copy button), what happens next, and a note if a
   person will review it.
2. A primary **Track your loan** button to the **Caltos customer module**, plus a secondary **Done**.
3. The app **never claims approval or disbursement**. Caltos decides and tells the customer.
4. The saved draft is deleted.

## 7. Resume: continue where you stopped

**Decision:** progress is saved, and a customer who stops can resume. Caltos holds no drafts (it receives the loan only at
submission), so Self-Serve saves it **on the customer's device**, tied to the verified phone number. Cross-device resume is
a later step (it needs a Self-Serve-owned service).

### 7.1 What the customer sees: a "Welcome back" step, not a modal
After the OTP, if this device holds a saved application for that number, show a full-screen step: "Welcome back. You have
an application in progress.", when it was last saved, **Continue from [step]** (primary) and **Start over** (secondary,
with a confirmation that says what will be deleted). A modal was rejected: it is easy to dismiss, awkward on small screens
and harder for screen readers. Silent jumping was rejected: it is disorienting.

### 7.2 What is saved, and what is not
Saved (bio data and work details, up to the salary step): contact, consent, intent, bio data, employment, salary account,
language, step reached, time, app version.

**Never saved:** BVN, NIN, documents, selfie, video, OTP, and anything Caltos decides (eligibility, products, offers).
Because loan documentation comes *after* the offer, the sensitive data is not needed for resume at all. This also settles
the earlier question about keeping BVN on the device: **it is not kept.**

### 7.3 What happens on Continue
The customer goes back to the step they were on. After the salary step, **eligibility runs again**, products are fetched
again, and their previous amount and tenor are preselected if they still fit. Then terms and loan documentation are done
fresh. A changed offer is simply shown as the new offer.

### 7.4 Rules
- Saved as the customer goes, not only at the end.
- **7-day lifetime** of inactivity, then deleted. Some mobile browsers clear site data after about a week of non-use for
  sites that are not installed; installing the PWA helps.
- Deleted on submit and on Start over. Resume needs OTP on the **same phone number**.
- Terms are accepted fresh at the terms step. Language resumes as last used.
- The draft records the app version so a newer version can migrate it.
- A customer who changes phone starts again; details Caltos holds for a returning customer reduce retyping.

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
| Products, limits, fees and settings come from Caltos | A catalogue in `src/shared/pricing.ts` stands in for Caltos (mandate mode, video mode, NIN requirement, amount and tenor limits) |
| Eligibility by partner (WACS, Remita), gender, corper, pensioner | Matched on employment type and channel (`ippis`, `remita`, `dedukt`) only. "WACS" is shown as IPPIS in the UI; confirm the naming |
| Eligibility calculated by Caltos | Calculated in the browser (a convenience; Caltos must re-score) |
| Documents and video sent to Caltos with the application | Only file names and sizes are sent; photo and video stay in memory and are cleared on submit |
| Required documents per product | One fixed document list |
| Face match and liveness on the selfie with ID | Not possible in the browser; needs Caltos or a partner |
| Real mandate link | Mock link; the real link and completion signal come from Caltos |
| Cross-device resume | Not built (device only) |
| USSD channel | Not built |
| Pensioners, private sector, self-employed | "Coming soon" or absent |

**Built in the app:** welcome intent, bio data and work details before eligibility, editable amount and tenor, early
knock-out, manual review without a dead end, translated decline with next steps, loan documentation after the offer, NIN
only when needed, selfie with ID plus video record or upload, mandate link, success screen with Track your loan, device
resume with Welcome back, consent and privacy notice, four-stage progress, PWA with versioning, Turnstile hook.

### 13.2 Decisions made (please confirm)

1. **Order:** bio data, work details, eligibility and offers, then loan documentation (your own format).
2. **Intent screen** at the start: take a loan now, or see how much I can get.
3. **Cost and fees are part of the offer**; the customer can change amount and tenor within limits.
4. **NIN is product-driven**, not always required.
5. **Keep the selfie holding ID**, as one live camera capture, with face match and liveness done by Caltos or a partner.
6. **No match against the BVN-registered phone** (customers may no longer have that number). Name and date of birth are
   matched instead.
7. **Resume is on the device**, up to the salary step, 7 days; eligibility always re-runs.
8. **The app never claims an outcome**; it sends the customer to the customer portal.
9. **A USSD channel is planned.** It will use the same Caltos eligibility and product services, so eligibility must live in
   Caltos, not the browser.
10. **Versioning follows the web app.**

### 13.3 Still needs a product decision

1. **More than one application or loan at a time.** What does Caltos allow across products?
2. **Previously declined customers.** Show history, or let them apply fresh? (Renmoney publishes a wait-before-reapply
   rule; do we want one?)
3. **Gender-restricted products.** Where does gender come from (BVN, bio data, Caltos)?
4. **Native reviewers** for Yoruba, Igbo and Hausa, and how approvals are recorded. All privacy, consent and fraud copy in
   the app was drafted by an engineer and needs Legal and native review.
5. **Tenor and amount limits.** Credit Direct advertises ₦20,000 to ₦5,000,000 and up to 36 months for public sector.
   Our catalogue is ₦30,000 to ₦300,000 and up to 12 months. Is that intended?

### 13.4 Integration details for the Caltos developers
See `BACKOFFICE-CONTRACT.md` (endpoints, the application token, identity checks that return match or no match only,
mandate link, submission fields, and the fraud controls Caltos or partners must enforce).

## 14. Competitor findings

Read from their public sites and Mobbin (not hands-on app tests). Sources: Credit Direct FAQ, Renmoney FAQ, articles.

- **Credit Direct (public sector):** the fast channels (USSD *5120# in about 3 minutes, WhatsApp) are for **pre-qualified**
  staff who already hold an offer. Products are split by Federal, State, Paramilitary and Private. Up to 36 months; ₦20,000 to
  ₦5,000,000. Eligibility shown publicly: age 22 to 58, at least 3 months in service, valid BVN, verifiable income.
- **Renmoney:** asks for **more** than we do (account, BVN, phone and email checks, ID, utility bill, bank statement or card
  details, e-signed offer letter, credit bureau check). Their FAQ also answers "why was I rejected" and "how long before I can
  reapply".
- **What they do better:** pre-qualification, more channels (USSD, WhatsApp, agents), speed claims of minutes, loan top-ups,
  and published rejection and reapply rules.
- **Our strengths:** four languages with read-aloud, salary-backed and mandate-backed lending, full transparency before
  accepting (schedule, fees, cost of credit), visible CBN and NDPR trust and complaint route, regional agents and offices,
  a light installable PWA, and a spoken-amount video.
- **Lesson:** our extra questions are not the problem; the problem was asking for effort **before** showing the reward. The
  new order fixes that. Pre-qualification (offers ready before the customer arrives) and USSD or WhatsApp are the next
  competitive moves.

## 15. Preventing misuse (stolen details, gaming)

The product must assume someone will try to apply with another person's details. In the app: name and date of birth must
match for BVN and NIN, identity lookups return match or no match only, nothing about a customer is revealed before OTP, a
bot check guards SMS, consent is recorded, and the selfie with ID and spoken video are captured live. **What the app cannot do
alone** and Caltos or partners must enforce: face match with liveness, disbursing only to the verified salary account,
mandate completed by the account holder, notifying the contact on file, verifying self-declared fields, re-scoring
eligibility, velocity and device checks, document verification, step-up for returning customers, and an active mandate and
salary history before disbursement. Full list in `BACKOFFICE-CONTRACT.md`.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.2.0 | 2026-11-09 | Customer-first order (bio data, work, offer, then documentation). Intent screen. Editable amount and tenor, cost and fees part of the offer. NIN product-driven. Selfie holding ID kept as one live capture. Manual review no longer a dead end; translated decline with next steps. Success screen with Track your loan. Resume trimmed to bio data and work details (no BVN on the device). Mandate link. Competitor findings and misuse prevention added. USSD on the roadmap |
| 1.1.0 | 2026-11-09 | Versioning based on the web app. Eligibility always re-runs on resume. Caltos holds no drafts, so progress is saved on the device in v1. PWA manifest and service worker. Open questions replaced with decisions |
| 1.0.0 | 2026-11-09 | First full version. Caltos is the source of truth and submission target. Resume, mandate links, documents and video as part of the application, tracking hand-off, versioning, measures, gaps |
| 0.1.0 | 2026-11-09 | Initial draft from the product owner's description |
