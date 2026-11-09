/** Development default: run the whole wizard against the in-process mock. */
export const environment = {
  production: false,
  /** Cloudflare Turnstile site key. Empty disables the bot check (set it, and TURNSTILE_SECRET, before launch). */
  turnstileSiteKey: '',
  /** Caltos customer module: where "Track your loan" sends the customer. */
  customerModuleUrl: 'https://caltos-rho.vercel.app/portal',
  useMockApi: true,
};
