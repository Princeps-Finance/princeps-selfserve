# Copy review

A read of every English string in the app (about 620), the voice we should use, what this pass changed, and what still
needs a decision. Yoruba, Igbo and Hausa follow the English and are drafts until a native speaker reviews them.

## Voice
- **Warm and plain.** Talk to one person ("you"), in short sentences. Say what is happening and what comes next.
- **Say why before asking.** The "Why we ask" cards do this; every screen that asks for something sensitive should.
- **No jargon.** Say "salary deduction", not "mandate"; "ID check", not "NIMC check"; "checking your BVN", not "checking with the bureau".
- **One word for one thing.** Loan, amount, repayment period (in months), monthly repayment, salary deduction.
- **Errors say what to do.** Never "Something went wrong" alone.
- **Never promise what we cannot guarantee** (timings, "instant", "no checks").

## Changed in this pass
| Screen | Before | After |
| --- | --- | --- |
| Language | Choose your language | Which language do you prefer? / You can change it at any time. |
| Welcome | How can we help? | Welcome to Princeps, with a one-line description, **Apply for a loan** ("Have your BVN and your salary account number ready.") and **See how much I can get** ("No BVN or code needed. About 2 minutes.") |
| BVN | We send a code to the phone linked to it. | We will text a code to the phone linked to it, to make sure it is you. |
| BVN loading | Checking with the bureau… | Checking your BVN… |
| Code | Enter the code | Enter the 6-digit code |
| Service error | Something went wrong. Try again in a moment. | We could not reach our service. Check your connection and try again. |
| Salary button | Verify | Check my salary |
| Eligibility | Checking your fit / Try again in a few months. | Checking what you qualify for / says it can change, and offers to talk to us |
| Review | The full picture | Review |
| Identity | Prove it's really you | Let's confirm it's you, with the steps and the time it takes; the privacy line now says the video is kept as a record of the loan terms (it is); the script label says to read it out loud |
| Repayment | Authorization / Authorize deduction | Salary deduction / Set up your repayment / Allow salary deduction |
| Submitted | Application received | We have your application, and asks them to keep their phone nearby |
| NIN | NIMC check | ID check |

64 strings that nothing in the app uses any more (the old contact screen, the old returning-customer screen, old offer and
status copy) were removed from all four languages, which also trims the app size.

## Still needs a decision
- **"NDPR compliant · Your data stays in Nigeria"** (footer). The NDPR was replaced by the Nigeria Data Protection Act 2023.
  Say "NDPA" only if it is true, and "stays in Nigeria" only if the data really is held there.
- **Privacy notice** does not mention religion (if asked), the alternate phone number, or that the video is kept as a record
  of the loan terms. It should, before those go live.
- **Religion hint** says it "helps us personalise offers". Confirm that is true or change it.
- **"Your offers" vs "Your loan options"** and **"Take a loan now" vs "Apply for a loan"**: the app uses both. Pick one pair.
- **Waitlist, status and helpline copy** still reads a little formal ("Agents by region", "Offices"); worth a pass with
  someone who answers the phone.
- **Money wording**: "Total repayable", "Cost of credit", "Yearly rate (estimated)" are accurate but technical. Consider a
  one-line "what this means" under the total.

## Screen by screen
I read the live text of each screen in the demo build (language, welcome, BVN, contact choice, code, details, work, salary,
offers, review, documents, identity intro) and the rest from the strings. **Fixed** means changed in this pull request.

| Screen | Verdict | Notes |
| --- | --- | --- |
| Language | Good | "Which language do you prefer? / You can change it at any time." |
| Welcome | Good | Says what it is, what to have ready, how long the check takes. |
| BVN | Good | The "Why we ask" card does the work. "Dial *565*0# to see it" is a useful touch. |
| Contact choice | Good | "I can't reach any of these" is the right escape. |
| Code | Good | Warns not to share the code. The demo hint ("Demo · 123456") is only in the demo build. |
| Details | Good | "Check what we found from your BVN and add anything missing." |
| Work type | Good | Federal and state are separate rows with a hint each. |
| Salary | Fixed | The button said "Verify"; now "Check my salary". |
| Offers | **Fixed** | Each loan ended "· Monthly", which read oddly. Now "Repaid monthly" (weekly and one-go too). |
| Review | Open | See below: fees and the total. |
| Documents | Good | Friendly. What it asks for comes from the back end in production. |
| Identity | **Fixed** | The intro said "You read one sentence out loud", but the script is now several lines. Now "a few short lines: your loan amount, repayments and dates". |
| Repayment set-up | **Fixed** | "Complete your mandate" and "Mandate completed" used jargon. Now "Finish setting up your repayment" and "Repayment set-up complete". |
| Submitted | **Fixed** | "We check your details and mandate" now says "salary deduction set-up". |
| Loans | **Fixed** | "Repayment mandate" is now "Salary deduction". |

### Open on the review screen (needs the back end's rule)
- **Fees and the total.** "Total repayable" is the amount plus interest, and the fees are listed separately. Say clearly whether
  the fees are taken from the amount you receive or added to the repayments, for example one line under the fee table. I did not
  guess, because it is the back end's rule.
- **"Yearly rate (estimated)"** can look alarming next to a monthly rate. Show the rate's unit ("4% a month") once the back end
  says what it is.
- **Dates** always show in English ("25 Nov 2026"), whatever language is chosen.

### Hard-coded text
I scanned every screen template for text that is not translated. Only brand names (WhatsApp, Remita), the date format hint
(YYYY) and the demo code hint remain. Nothing else is English-only.
