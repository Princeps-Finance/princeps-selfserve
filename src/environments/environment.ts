/** Development default: run the whole wizard against the in-process mock. */
export const environment = {
  production: false,
  /** Cloudflare Turnstile site key. Empty disables the bot check (set it, and TURNSTILE_SECRET, before launch). */
  turnstileSiteKey: '',
  /** The Princeps Accounts app: where "Already a customer? Sign in" and "Track your loan" send the customer. Live on the development link for now; change it to the real address when it moves. The links stay hidden while it is empty. */
  accountsUrl: 'https://princeps-accounts.princeps-selfserve.workers.dev',
  /** Web Push public key (VAPID). Empty hides the "turn on notifications" prompt. Set it before launch; the private key stays on the back end. */
  vapidPublicKey: '',
  useMockApi: true,
  /** Shows a "Demo" strip and the demo OTP hint. */
  demoBanner: true,
};
