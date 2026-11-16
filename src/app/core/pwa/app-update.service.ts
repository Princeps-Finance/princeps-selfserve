import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, interval, merge } from 'rxjs';

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

  private checking = false;

  constructor() {
    if (typeof window === 'undefined') return;
    fromEvent(window, 'online')
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.offline.set(false));
    fromEvent(window, 'offline')
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.offline.set(true));
    if (!this.sw?.isEnabled) return;

    merge(
      this.sw.versionUpdates.pipe(filter((event) => event.type === 'VERSION_READY')),
      this.sw.unrecoverable,
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateReady.set(true));

    void this.checkForUpdate();
    merge(
      fromEvent(document, 'visibilitychange').pipe(
        filter(() => document.visibilityState === 'visible'),
      ),
      interval(CHECK_EVERY_MS),
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.checkForUpdate());
  }

  private async checkForUpdate(): Promise<void> {
    if (!this.sw || this.offline() || this.checking) return;
    this.checking = true;
    try {
      await this.sw.checkForUpdate();
    } catch {
      // A later scheduled check can retry.
    } finally {
      this.checking = false;
    }
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
