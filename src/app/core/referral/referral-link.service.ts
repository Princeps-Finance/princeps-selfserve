import { Injectable, Injector, inject } from '@angular/core';
import { API_CLIENT } from '../api/api-client';
import { ApplicationStateService } from '../application/application-state.service';
import { logWarn } from '../log';

const KEY = 'princeps.referral-link';
const SHAPE = /^[A-Za-z0-9]{3,20}$/;

/**
 * A referral link looks like `https://…/?ref=WELCOME`. The code is read once when the app opens (the router
 * drops the query string on the first redirect), kept for the visit, and checked with the server when the
 * offers step is reached. A valid code is applied without the customer typing anything.
 */
@Injectable({ providedIn: 'root' })
export class ReferralLinkService {
  // Looked up only when a code is checked, so reading the link at startup needs nothing else.
  private readonly injector = inject(Injector);
  private readonly state = inject(ApplicationStateService);
  private pending: string | null = this.capture();

  /** Applies the code from the link, once, unless the customer already has one. Invalid codes are dropped quietly. */
  async applyPending(): Promise<void> {
    const code = this.pending;
    if (!code || this.state.referral()) return;
    this.pending = null;
    this.forget();
    const found = await this.injector.get(API_CLIENT).checkReferral(code).catch((err: unknown) => {
      logWarn('referral link check failed', err);
      return null;
    });
    if (found && !this.state.referral()) this.state.setReferral(found);
  }

  private capture(): string | null {
    try {
      const fromUrl = new URLSearchParams(location.search).get('ref')?.trim() ?? '';
      if (SHAPE.test(fromUrl)) {
        sessionStorage.setItem(KEY, fromUrl);
        return fromUrl;
      }
      const saved = sessionStorage.getItem(KEY);
      return saved && SHAPE.test(saved) ? saved : null;
    } catch {
      return null; // Storage blocked: the link still works for this page load only if it was read above.
    }
  }

  private forget(): void {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* nothing to forget */
    }
  }
}
