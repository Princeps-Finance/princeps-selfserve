import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { TPipe } from '../i18n/t.pipe';
import { ModalComponent } from '../../shared/modal.component';
import { AppUpdateService } from './app-update.service';

/** Nothing has been typed yet: a ready update is applied automatically. */
const AUTO_APPLY_ROUTES = new Set(['/', '/apply', '/apply/welcome']);

@Component({
  selector: 'app-pwa-banner',
  imports: [TPipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (updater.offline()) {
      <p class="banner banner--offline" role="status">{{ 'pwa.offline' | t }}</p>
    }
    <app-modal [open]="showUpdate() && !dismissed()" [title]="'pwa.update.title' | t" (closed)="dismissed.set(true)">
      <div class="update">
        <h2 class="update-title">{{ 'pwa.update.title' | t }}</h2>
        <p class="update-body">{{ 'pwa.update.ready' | t }}</p>
        <button type="button" class="cta" (click)="updater.apply()"><span>{{ 'pwa.update.action' | t }}</span></button>
        <button type="button" class="alt" (click)="dismissed.set(true)">{{ 'pwa.update.later' | t }}</button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      /* In flow (sticky), so the notice pushes content down instead of covering controls. */
      :host {
        display: block; position: sticky; top: env(safe-area-inset-top); z-index: 70;
        padding: 0 var(--space-4);
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
      .update { display: flex; flex-direction: column; gap: var(--space-3); }
      .update-title { margin: 0; font-family: var(--font-display); font-size: var(--fs-xl); font-weight: 600; }
      .update-body { margin: 0; color: var(--ink-soft); line-height: 1.5; }
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

  /** On every screen: the customer is told, and chooses Update (reloads at once) or Later (this visit only). */
  readonly showUpdate = computed(() => this.updater.updateReady() && !AUTO_APPLY_ROUTES.has(this.path()));

  constructor() {
    // On the first screens nothing can be lost, so a ready update is applied automatically.
    effect(() => {
      if (this.updater.updateReady() && AUTO_APPLY_ROUTES.has(this.path())) void this.updater.apply();
    });
  }
}
