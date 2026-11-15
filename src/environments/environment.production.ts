/**
 * LIVE (branch self-service-production): the app calls the real /api functions, shows no "Demo" strip and no
 * demo OTP hint, and fails closed if the back office is not reachable (see BACKOFFICE-CONTRACT.md).
 * The demo build with the in-process mock lives on the self-service-development branch.
 */
export const environment = {
  production: true,
  /** Cloudflare Turnstile site key. Empty disables the bot check (set it, and TURNSTILE_SECRET, before launch). */
  turnstileSiteKey: '',
  /** The Princeps Accounts app: where "Already a customer? Sign in" and "Track your loan" send the customer. Empty until the live address is known (the links stay hidden). Use the Princeps domain, not a workers.dev or vercel.app address. */
  accountsUrl: '',
  /** Web Push public key (VAPID). Empty hides the "turn on notifications" prompt. Set it before launch; the private key stays on the back end. */
  vapidPublicKey: '',
  useMockApi: false,
  demoBanner: false,
};
