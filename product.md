# Princeps Self-Serve — Product

> Source of truth for what Self-Serve is meant to be. Written from the product
> owner's description and checked against the code. Where the code does not yet
> match, see **Gaps between this vision and the code**.

## What it is

Princeps Self-Serve is the front door where a customer applies for a Princeps
loan **by themselves**, on their phone, in their own language, without calling an
agent or visiting an office.

It does one job: **take a loan application from first tap to a clean submission.**
Everything after that happens elsewhere.

## What it is not

| Not this | Where it lives |
| --- | --- |
| Loan processing, approval, disbursement | **Caltos** (Princeps' loan management system) |
| Managing an existing loan: repayments, loan documents, statements | **Caltos customer module** (a separate product) |
| A rebuild of Caltos | Self-Serve only creates the request; Caltos owns the loan |

Self-Serve never decides a loan. It collects, checks and submits; Caltos
processes.

## Who it is for

Princeps customers across Nigeria, mostly on mid-range Android phones, often on
weak or expensive data, with a wide range of literacy and English fluency.
Today's segments: federal/state civil servants, paramilitary staff, NYSC corpers.
Planned: pensioners, and private-sector and self-employed customers. Which
segment a customer can apply under is decided by the products Caltos exposes (see
below), not hard-coded in the app.

**Language is a core requirement, not a feature.** English, Yoruba, Igbo and Hausa
must be complete, consistent and understandable for every step, error and
confirmation, with a read-aloud option. A customer should never hit English-only
text, an untranslated key, or a message they cannot act on.

## Principle: Caltos is the source of truth

Princeps creates its loan products in Caltos. Self-Serve **reads** them and adapts.
Product rules are configuration in Caltos, not code in Self-Serve.

A loan product in Caltos decides:

- **Who can see it (eligibility type).** Salary processing partner (WACS or
  Remita), gender (some products are women-only or men-only), corper, pensioner,
  and similar.
- **What the customer is shown.** Only products that match them, and only these
  fields: **product name, amount, tenor, interest rate, interest type.** No fees
  or terms the product does not define.
- **Which mandate is set up.** The product's settings say what mandate
  (repayment collection) the loan needs, so the mandate step follows the product.
- **Which identity confirmation is needed.** A product may require none, or a
  **video** where the customer says some details out loud, delivered as either:
  - **record on the site**, or
  - **upload / a generated link**, or
  - **both, and the customer picks one.**
- **Which documents** are required.

Because the journey depends on the matched product, **the number and order of
steps can differ between customers.** The app must build the journey from the
product, not from a fixed 14-step list.

## The journey

1. **Choose language** (English, Yoruba, Igbo, Hausa). Remembered; switching
   mid-flow keeps everything entered.
2. **Contact + phone check.** Phone number, email, OTP. A returning customer is
   recognised and can skip details that are still valid, but their identity and
   bank details are still confirmed again.
3. **Bio data.** Name, date of birth, address, relationship status, and the
   identity checks the products require (BVN, NIN).
4. **Employment type and details.** Employer, salary processing partner, salary
   account, IPPIS number where relevant. This is what places the customer in the
   right eligibility group.
5. **Eligibility** is calculated in the background from the verified details.
   The customer is not asked to understand a score; they see the result.
6. **Matching products.** Only products they qualify for, showing name, amount,
   tenor, interest rate and interest type. The customer chooses one.
7. **Terms.** Full terms and repayment schedule for the chosen product.
8. **Mandate.** Set up exactly as the product defines.
9. **Documents and identity confirmation** as the product requires (including the
   video option described above).
10. **Review and submit.** The application is sent to Caltos.
11. **Status.** The customer sees that it was received, what happens next, how
    long it takes, and how to get help. WhatsApp updates are optional.

Customers who do not qualify yet (for example a segment that is not live) join a
**waitlist** with a clear message, instead of a dead end.

After submission, the customer manages the loan, repays and gets documents in the
**Caltos customer module**. Self-Serve should point them there clearly.

## Success

**A customer can apply for a loan successfully, with no issues. The happy path
and the unhappy paths are both clear, and the customer never feels stuck.**

Concretely, at every step the customer can answer: *Where am I? What do I do
next? What happens if this goes wrong?*

### Happy path
Fast, few steps, nothing asked twice, progress always visible, ends with a
confirmation and a reference they can quote.

### Unhappy paths (each needs a clear, translated, actionable message)
- Wrong or expired OTP, too many attempts → what to do, when to retry.
- BVN or NIN not found, or name mismatch → fix it or get help.
- Salary account not found, or name mismatch → fix it or get help.
- Not eligible, or no product matches → say so plainly and offer the next best
  option (waitlist, another product, an agent).
- Offer no longer valid (rates or limits changed) → restart cleanly, not an
  unexplained error.
- Camera, microphone or upload problems → alternative path (link, upload) or
  help.
- Network drops or Caltos/partners are down → say it is not the customer's
  fault, keep their progress where it is safe to, and let them retry.
- Anything else → a way to reach a human (agent line, WhatsApp, office).

Rules for every message: say what happened, say what to do, never blame the
customer, never show a raw error or key, always offer help.

## Non-negotiables

- **Trust and compliance.** CBN-licensed, NDPR-compliant, data stays in Nigeria,
  clear complaint route. Regulatory text stays visible.
- **No fake outcomes.** The app never shows an approval or a verification the
  system did not actually produce.
- **Sensitive data.** BVN, NIN, bank details and any face or video capture are
  handled minimally, never logged, and cleared when no longer needed.
- **Server decides.** Prices, eligibility and verification are confirmed server
  side. The browser is a convenience, not a source of trust.
- **Accessible and light.** Works at 320px, with keyboard and screen readers,
  on slow connections.

## Gaps between this vision and the code

The code was built ahead of Caltos integration, so several things are hard-coded
that this vision says should come from Caltos:

| Vision | Today in the code |
| --- | --- |
| Products fetched from Caltos and matched per customer | Four products hard-coded in `src/shared/pricing.ts` |
| Eligibility types include partner (WACS/Remita), gender, corper, pensioner | Matched on employment type and channel (`ippis`, `remita`, `dedukt`) only |
| Mandate step follows product settings | Mandate channel derived from employment type |
| Video confirmation is per product: record, link or both | One fixed record-on-site step for everyone |
| Documents and steps differ by product | One fixed document list and a fixed 14-step journey |
| Eligibility calculated in the background, server-side | Calculated in the browser from verified income |
| Submits to Caltos | Submits to a `princeps-backoffice` endpoint; unclear whether that is Caltos |
| Customer is pointed to Caltos customer module after submit | Status page links to a Caltos portal URL on the language screen only |
| Pensioners, private sector, self-employed | Shown as "coming soon" or absent |

## Open questions

1. **Is `princeps-backoffice` the same system as Caltos, or a layer in front of
   it?** The code posts loans to `princeps-backoffice`; the business processes
   them in Caltos.
2. **How does Self-Serve read Caltos?** Is there an API for products, product
   settings (mandate, video, documents) and eligibility rules, and who owns it?
3. **Where does the eligibility calculation run**, and who owns the rules?
4. **Where do documents and the identity video go?** Today only file names and
   sizes are sent; the captured video is kept in memory. Does Caltos accept
   uploads, or does the link option hand off to something else?
5. **What does the "link" option generate** and where does the customer complete
   it? How does Self-Serve learn it was completed?
6. **What happens after submit?** Does Caltos return a decision synchronously, or
   is it always a review? How does the customer get updates and the repayment
   schedule?
7. **Returning customers:** which profile fields can safely be reused, and what
   is the rule for previously declined customers?
8. **Gender-restricted products:** where does gender come from (BVN, bio data),
   and how do we ask for it without confusion?
