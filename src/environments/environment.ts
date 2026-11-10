/** Development default: run the whole wizard against the in-process mock. */
export const environment = {
  production: false,
  /** Cloudflare Turnstile site key. Empty disables the bot check (set it, and TURNSTILE_SECRET, before launch). */
  turnstileSiteKey: '',
  /** Caltos customer module: where "Track your loan" sends the customer. */
  customerModuleUrl: 'https://caltos-rho.vercel.app/portal',
  /** Web Push public key (VAPID). Empty hides the "turn on notifications" prompt. Set it before launch; the private key stays on the back end. */
  vapidPublicKey: '',
  useMockApi: true,
  /** Shows a "Demo" strip and the demo OTP hint. */
  demoBanner: true,
};
