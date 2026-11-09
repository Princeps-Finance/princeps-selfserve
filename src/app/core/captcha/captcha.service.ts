import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: Record<string, unknown>): string;
      execute(id: string): void;
      reset(id: string): void;
    };
  }
}

/**
 * Cloudflare Turnstile bot check, used before an SMS is sent (SMS costs money and can be used
 * to harass someone). With no site key configured it does nothing and returns undefined, so
 * development works; set `turnstileSiteKey` and the server's TURNSTILE_SECRET to enforce it.
 */
@Injectable({ providedIn: 'root' })
export class CaptchaService {
  private loading: Promise<void> | null = null;
  private widgetId: string | null = null;

  private load(): Promise<void> {
    this.loading ??= new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('captcha-script'));
      document.head.appendChild(s);
    });
    return this.loading;
  }

  /** Resolves to a token, or undefined when the check is not configured. */
  async token(): Promise<string | undefined> {
    const siteKey = environment.turnstileSiteKey;
    if (!siteKey) return undefined;
    try {
      await this.load();
    } catch {
      return undefined; // The server decides what to do without a token.
    }
    return new Promise<string | undefined>((resolve) => {
      const host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.bottom = '8px';
      host.style.left = '8px';
      document.body.appendChild(host);
      const done = (value: string | undefined) => {
        host.remove();
        resolve(value);
      };
      this.widgetId = window.turnstile!.render(host, {
        sitekey: siteKey,
        size: 'invisible',
        callback: (t: string) => done(t),
        'error-callback': () => done(undefined),
        'timeout-callback': () => done(undefined),
      });
      window.turnstile!.execute(this.widgetId);
    });
  }
}
