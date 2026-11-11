import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Tracks service-worker updates and connectivity.
 *
 * A new version is downloaded in the background but never applied mid-step:
 * the banner (and the automatic apply on the start screen) only act at safe
 * points, so a customer never loses what they typed.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly sw = inject(SwUpdate, { optional: true });

  /** A newer version is downloaded and ready to apply. */
  readonly updateReady = signal(false);
  readonly offline = signal(typeof navigator !== 'undefined' && !navigator.onLine);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.offline.set(false));
      window.addEventListener('offline', () => this.offline.set(true));
    }
    if (!this.sw?.isEnabled) return;

    this.sw.versionUpdates
      .pipe(filter((e) => e.type === 'VERSION_READY'))
      .subscribe(() => this.updateReady.set(true));
    // If the cached app is broken, a reload is the only safe recovery.
    this.sw.unrecoverable.subscribe(() => this.updateReady.set(true));

    // An installed app is rarely closed, only put away: look for a new version each time it comes back to the front.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.offline()) void this.sw?.checkForUpdate().catch(() => undefined);
    });

    setInterval(() => {
      if (!this.offline()) void this.sw?.checkForUpdate().catch(() => undefined);
    }, CHECK_EVERY_MS);
  }

  /** Activates the downloaded version and reloads. Call only at a safe point. */
  async apply(): Promise<void> {
    try {
      await this.sw?.activateUpdate();
    } catch {
      // Reloading still picks up the newest version.
    }
    location.reload();
  }
}
