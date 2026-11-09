import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { TPipe } from '../i18n/t.pipe';
import { AppUpdateService } from './app-update.service';

/** Nothing has been typed yet: a ready update is applied automatically. */
const AUTO_APPLY_ROUTES = new Set(['/', '/apply', '/apply/welcome']);
/** Little or nothing to lose: offer the update, the customer decides. */
const OFFER_ROUTES = new Set([...AUTO_APPLY_ROUTES, '/apply/contact', '/apply/bvn', '/apply/status']);

@Component({
  selector: 'app-pwa-banner',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (updater.offline()) {
      <p class="banner banner--offline" role="status">{{ 'pwa.offline' | t }}</p>
    }
    @if (showUpdate()) {
      <div class="banner banner--update" role="status">
        <span>{{ 'pwa.update.ready' | t }}</span>
        <button type="button" class="action" (click)="updater.apply()">
          {{ 'pwa.update.action' | t }}
        </button>
      </div>
    }
  `,
  styles: [
    `
      /* In flow (sticky), so the notice pushes content down instead of covering controls. */
      :host {
        display: block; position: sticky; top: 0; z-index: 70;
        padding: env(safe-area-inset-top) var(--space-4) 0;
      }
      .banner {
        margin: var(--space-2) auto 0; max-width: 520px; width: 100%;
        display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--ink); color: #fff;
        font-size: 14px; line-height: 1.4;
        box-shadow: var(--shadow-3);
      }
      .banner--offline { background: var(--navy-950); }
      .action {
        min-height: 44px; padding: 0 var(--space-4);
        border: 1px solid #fff; border-radius: var(--radius-pill);
        background: transparent; color: #fff;
        font: inherit; font-weight: 600; cursor: pointer;
      }
      .action:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    `,
  ],
})
export class PwaBannerComponent {
  protected readonly updater = inject(AppUpdateService);
  private readonly router = inject(Router);

  private readonly path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split('?')[0]),
      startWith(this.router.url.split('?')[0]),
    ),
    { initialValue: '/' },
  );

  private readonly atSafePoint = computed(() => OFFER_ROUTES.has(this.path()));
  readonly showUpdate = computed(() => this.updater.updateReady() && this.atSafePoint());

  constructor() {
    // On the first screens nothing can be lost, so a ready update is applied automatically.
    effect(() => {
      if (this.updater.updateReady() && AUTO_APPLY_ROUTES.has(this.path())) void this.updater.apply();
    });
  }
}
