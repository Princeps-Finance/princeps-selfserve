import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { TPipe } from '../i18n/t.pipe';
import { PromoBannerComponent } from '../../shared/promo-banner.component';
import { AppUpdateService } from './app-update.service';

/** Nothing has been typed yet: a ready update is applied automatically. */
const AUTO_APPLY_ROUTES = new Set(['/', '/apply', '/apply/welcome']);
/** Little or nothing to lose: offer the update, the customer decides. */
const OFFER_ROUTES = new Set([...AUTO_APPLY_ROUTES, '/apply/bvn', '/apply/status']);

@Component({
  selector: 'app-pwa-banner',
  imports: [TPipe, PromoBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (updater.offline()) {
      <p class="banner banner--offline" role="status">{{ 'pwa.offline' | t }}</p>
    }
    @if (showUpdate() && !dismissed()) {
      <app-promo-banner
        class="update"
        role="status"
        [title]="'pwa.update.title' | t"
        [description]="'pwa.update.ready' | t"
        [ctaLabel]="'pwa.update.action' | t"
        [dismissLabel]="'common.dismiss' | t"
        imageSrc="icons/icon-192.png"
        [imageWidth]="192"
        [imageHeight]="192"
        (action)="updater.apply()"
        (dismissed)="dismissed.set(true)"
      />
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
        background: var(--ink); color: var(--canvas);
        font-size: var(--fs-md); line-height: 1.4;
        box-shadow: var(--shadow-3);
      }
      .banner--offline { background: var(--navy-950); }
      .update { margin: var(--space-2) auto 0; max-width: 520px; width: 100%; box-shadow: var(--shadow-3); border-radius: var(--radius-lg); }
    `,
  ],
})
export class PwaBannerComponent {
  protected readonly updater = inject(AppUpdateService);
  /** The customer can put the update off; the banner stays away for the rest of the visit. */
  protected readonly dismissed = signal(false);
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
