/**
 * DEMO PERIOD: Caltos endpoints are not connected yet, so the deployed app runs on the
 * in-process mock (OTP 123456) with a visible "Demo" strip. Nothing real is sent.
 *
 * BEFORE REAL CUSTOMERS: set `useMockApi: false` and `demoBanner: false`. The app then
 * calls the /api functions and fails closed if Caltos is not reachable (see
 * BACKOFFICE-CONTRACT.md).
 */
export const environment = {
  production: true,
  /** Cloudflare Turnstile site key. Empty disables the bot check (set it, and TURNSTILE_SECRET, before launch). */
  turnstileSiteKey: '',
  /** The Princeps Accounts app: where "Already a customer? Sign in" and "Track your loan" send the customer. Leave empty until that app is live; the links stay hidden while it is empty. */
  accountsUrl: '',
  /** Web Push public key (VAPID). Empty hides the "turn on notifications" prompt. Set it before launch; the private key stays on the back end. */
  vapidPublicKey: '',
  useMockApi: true,
  demoBanner: true,
};
