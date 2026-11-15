import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LangService } from '../i18n/lang.service';
import { ToastService } from '../toast/toast.service';
import { APPLY } from '../flow/apply-routes';
import { ApplicationStateService } from './application-state.service';

const CHANNEL = 'princeps-tabs';
const RECEIPT_KEY = 'princeps.receipt';

/**
 * Two tabs on the same application would overwrite each other's saved progress and could send it twice. This tells the
 * customer when a second tab is open, and when the other tab has already sent the application it moves this one to the
 * success screen instead of leaving it on a form that would send a duplicate.
 */
@Injectable({ providedIn: 'root' })
export class MultiTabService {
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LangService);
  private readonly router = inject(Router);
  private readonly state = inject(ApplicationStateService);
  private readonly id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random());
  private channel: BroadcastChannel | null = null;
  private warned = false;

  constructor() {
    if (typeof window === 'undefined') return;
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (e: MessageEvent<{ t?: string; id?: string }>) => {
        if (!e.data || e.data.id === this.id) return;
        if (e.data.t === 'hello') this.channel?.postMessage({ t: 'here', id: this.id });
        this.warnOnce();
      };
      this.channel.postMessage({ t: 'hello', id: this.id });
    }
    window.addEventListener('storage', (e) => {
      if (e.key !== RECEIPT_KEY || !e.newValue) return;
      this.otherTabSent();
    });
  }

  private warnOnce(): void {
    if (this.warned) return;
    this.warned = true;
    this.toast.info(this.lang.t('tabs.other'), 9000);
  }

  /** The other tab sent the application: this one must not, so it goes to the success screen. */
  private otherTabSent(): void {
    const here = this.router.url.split('?')[0];
    if (here.startsWith(APPLY.root) && here !== APPLY.status && this.state.restoreReceipt()) {
      this.toast.info(this.lang.t('tabs.sent'), 7000);
      void this.router.navigateByUrl(APPLY.status);
    }
  }
}
