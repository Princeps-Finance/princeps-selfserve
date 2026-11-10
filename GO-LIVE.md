# Go-live checklist

Everything here must be ticked on the `self-service-production` branch before real customers use the app.
`npm run check:live` fails while any box is open, and CI runs it on every pull request into that branch.
Tick a box only when it is done and tested, not when it is planned.

## 1. Settings on the production branch
- [ ] `environment.production.ts`: `useMockApi: false`, `demoBanner: false`, `turnstileSiteKey` set, `customerModuleUrl` on the Princeps domain.
- [ ] `support.ts`: real support phone, WhatsApp and email. (The licence number is optional: leave `LICENCE_NUMBER` empty and nothing is shown.)
- [ ] The production domain is set up on Vercel and `ALLOWED_ORIGINS` lists it.

## 2. Vercel environment variables (production only)
- [ ] `BACKOFFICE_API_URL` and `SELFSERVE_INGEST_TOKEN`: where our server sends calls, and its key.
- [ ] `SELF_SERVICE_API_URL`: the live self-service API, `https://self-service-api.princeps.cloud`. Used to read which employment types are open.
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: the shared rate-limit store. Without them the app refuses every limited call on purpose.
- [ ] `TURNSTILE_SECRET`: the bot check. Turnstile is Cloudflare's free "are you a person" check. Create a widget in the Cloudflare dashboard, put the site key in the environment file and the secret here. Without it, anyone can script the code-sending calls and run up the SMS bill.
- [ ] `SMS_HOURLY_CAP` reviewed (default 1000 texts an hour across all customers).

## 3. What the back end (Caltos and the self-service API) must do
These cannot be checked from this repository. Each needs a test against the real API, written down below it.
- [ ] **The token is bound to the person.** A token from verifying phone A must be refused when the loan names a different BVN, phone or bank account. Test: verify your own phone, submit with someone else's BVN, expect a refusal.
- [ ] **Codes lock.** After 5 wrong guesses on one BVN or phone, the code stops working, from any address. Test: guess wrong 6 times from two addresses.
- [ ] **Eligibility is decided on the server.** Today the browser scores it (`eligibility-scoring.ts`) in every build, demo or live, and `submit-loan` does not check it. Wire the app to the server's eligibility call, and make submit refuse an amount above the server's maximum.
- [ ] **Submit prices from the stored offer**, not from what the browser sends, and a repeat submit returns the same loan.
- [ ] **A lookup never leaks.** `verify-salary` returns `monthlyIncome` and `accountName`: confirm both are needed by the screen, and that the call is limited per token and per account.

## 4. Before the first real customer
- [ ] Yoruba, Igbo and Hausa translations done and reviewed by native speakers (`docs/translations-needed.csv`).
- [ ] One full application on a real phone, in each language, on the production domain.
- [ ] Dependency audit clean (`npm audit --omit=dev`).

## Where the live API fits
The live API (`self-service-api.princeps.cloud/docs`, v0.1.0) is organised around one application with a resume token. Our server speaks a different set of calls (`/api/selfserve/<op>`), so the live API cannot be plugged in directly: a small adapter in `api/` has to translate. Mapping, from the live docs:

| We need | Live API call | Status |
| --- | --- | --- |
| Start, verify the code | `POST /api/applications`, `POST /api/applications/{id}/otp/verify` | Exists. Starts from email and phone, not BVN alone |
| Salary check | `employment-verification/government/remita`, `.../ippis`, `.../paramilitary/dedukt` | Exists |
| Products and offers | `GET /api/products`, `GET /api/products/{id}/journey`, `GET /api/employment-types` | Exists. No quote call |
| BVN, NIN, account-name checks | `verifications/sync` and `verifications/{checkKey}/execute` | Exists. Our server must not let the browser choose the check |
| Save and resume | `GET` and `PATCH /api/applications/{id}` | Exists. Could replace the saved draft on the phone |
| Documents | `POST .../documents/presign` | Exists |
| Submit | `POST .../submit` | Exists. Needs names, address, state and country ids |
| Eligibility decision, banks, states and LGAs, resend code, quote, your loans, mandate, statement review, waitlist, BVN-first start | none in the deployed docs | Missing from the deployed spec. The back end's phase 1 and 2 pull request lists some of these: ask for it to be deployed |

See `BACKEND-REQUESTS.md` for the full list of gaps.
