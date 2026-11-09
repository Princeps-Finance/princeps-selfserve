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
  /** Caltos customer module: where "Track your loan" sends the customer. */
  customerModuleUrl: 'https://caltos-rho.vercel.app/portal',
  useMockApi: true,
  demoBanner: true,
};
