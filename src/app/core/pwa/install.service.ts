import { Injectable, computed, inject, signal } from '@angular/core';
import { LangService } from '../i18n/lang.service';
import { ToastService } from '../toast/toast.service';

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
  private deferred: BeforeInstallPromptEvent | null = null;
  private readonly dismissed = signal(read());
  private readonly installed = signal(
    typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true,
  );

  /** False once installed or dismissed, so the offer never nags. */
  readonly offer = computed(() => !this.installed() && !this.dismissed());

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e as BeforeInstallPromptEvent;
    });
    window.addEventListener('appinstalled', () => this.installed.set(true));
  }

  async install(): Promise<void> {
    if (this.deferred) {
      await this.deferred.prompt();
      const { outcome } = await this.deferred.userChoice;
      this.deferred = null;
      if (outcome === 'accepted') this.installed.set(true);
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    this.toast.info(
      this.lang.t(ios ? 'install.hint.ios' : 'install.hint.other'),
      6000,
    );
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
