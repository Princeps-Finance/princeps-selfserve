import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { LangService } from '../i18n/lang.service';
import { ToastService } from '../../shared/components/toast/toast.service';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'princeps.install.dismissed';

function read(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Offers "add to home screen". Uses the browser's install prompt where it exists, instructions elsewhere (iOS Safari). */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LangService);
  private installNoticeTimer?: ReturnType<typeof setTimeout>;
  private deferred: BeforeInstallPromptEvent | null = null;
  private readonly dismissed = signal(read());
  private readonly installed = signal(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(display-mode: standalone)').matches === true,
  );

  /** False once installed or dismissed, so the offer never nags. */
  readonly offer = computed(() => !this.installed() && !this.dismissed());

  constructor() {
    if (typeof window === 'undefined') return;
    const listeners = new AbortController();
    window.addEventListener(
      'beforeinstallprompt',
      (event) => {
        event.preventDefault();
        this.deferred = event as BeforeInstallPromptEvent;
        this.announce();
      },
      { signal: listeners.signal },
    );
    window.addEventListener(
      'appinstalled',
      () => {
        this.installed.set(true);
        this.deferred = null;
        clearTimeout(this.installNoticeTimer);
      },
      { signal: listeners.signal },
    );
    inject(DestroyRef).onDestroy(() => {
      listeners.abort();
      clearTimeout(this.installNoticeTimer);
      this.deferred = null;
    });
  }

  /** Once per visit, a short while after the browser says the app can be installed, say so with an Install button. Desktop only: phones get the card's own instructions. */
  private announce(): void {
    if (!window.matchMedia?.('(min-width: 1024px)').matches) return;
    clearTimeout(this.installNoticeTimer);
    this.installNoticeTimer = setTimeout(() => {
      if (!this.offer() || !this.deferred) return;
      this.toast.info(this.lang.t('install.notice'), {
        durationMs: 10_000,
        action: { label: this.lang.t('install.notice.cta'), run: () => void this.install() },
      });
    }, 15_000);
  }

  async install(): Promise<void> {
    if (this.deferred) {
      const prompt = this.deferred;
      this.deferred = null;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') this.installed.set(true);
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    this.toast.info(this.lang.t(ios ? 'install.hint.ios' : 'install.hint.other'), 6000);
  }

  dismiss(): void {
    this.dismissed.set(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* storage unavailable; hidden for this session only */
    }
  }
}
