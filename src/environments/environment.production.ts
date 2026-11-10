/**
 * LIVE (branch self-service-production): the app calls the real /api functions, shows no "Demo" strip and no
 * demo OTP hint, and fails closed if the back office is not reachable (see BACKOFFICE-CONTRACT.md).
 * The demo build with the in-process mock lives on the self-service-development branch.
 */
export const environment = {
  production: true,
  /** Cloudflare Turnstile site key. Empty disables the bot check (set it, and TURNSTILE_SECRET, before launch). */
  turnstileSiteKey: '',
  /** Caltos customer module: where "Track your loan" sends the customer. */
  customerModuleUrl: 'https://caltos-rho.vercel.app/portal',
  useMockApi: false,
  demoBanner: false,
};
