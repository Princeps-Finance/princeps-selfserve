/**
 * Production build: the mock client is never used. Identity, OTP, salary and
 * submission all go through the /api functions to the backoffice.
 */
export const environment = {
  production: true,
  /** Cloudflare Turnstile site key. Empty disables the bot check (set it, and TURNSTILE_SECRET, before launch). */
  turnstileSiteKey: '',
  /** Caltos customer module: where "Track your loan" sends the customer. */
  customerModuleUrl: 'https://caltos-rho.vercel.app/portal',
  useMockApi: false,
};
