import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { LanguageMenuComponent } from './language-menu.component';
import { APPLY } from '../../core/flow/apply-routes';
import { BackButtonComponent } from './back-button.component';
import { ReadAloudComponent } from './read-aloud.component';
import { BrandLogoComponent } from '../../shared/brand-logo.component';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

const NO_BACK_ROUTES = new Set<string>([APPLY.root, `${APPLY.root}/`, APPLY.status, APPLY.loans]);

@Component({
  selector: 'app-apply-shell',
  imports: [RouterOutlet, LanguageMenuComponent, BackButtonComponent, ReadAloudComponent, ThemeToggleComponent, BrandLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <!-- Top bar: on a phone the back arrow comes first, and the logo sits under it on the same row as the controls. On wide screens the arrow moves into the card. -->
      <header class="topbar">
        @if (showBack()) {
          <app-back-button class="back-phone" />
        }
        <div class="topbar-row">
          <app-brand-logo class="brand-logo" />
          <div class="topbar-right">
            <app-read-aloud />
            <app-theme-toggle />
            <app-language-menu />
          </div>
        </div>
      </header>

      <div class="shell">
        @if (showBack()) {
          <div class="card-top"><app-back-button /></div>
        }

        <main class="body">
          <router-outlet />
        </main>

      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; min-height: 100dvh; background: var(--canvas); color: var(--ink); }
      /* Room at the bottom so the floating Support button never sits on top of a step's main button. */
      .page { min-height: 100dvh; display: flex; flex-direction: column; padding-bottom: calc(var(--tap-min) + var(--space-8)); box-sizing: border-box; }
      .topbar { display: flex; flex-direction: column; align-items: stretch; width: 100%; box-sizing: border-box; padding: var(--space-2) var(--space-4) 0; }
      .topbar-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: 56px; }
      .topbar-right { display: inline-flex; align-items: center; gap: var(--space-2); }
      .brand-logo { height: 30px; width: auto; display: block; }
      .card-top { display: none; }
      .shell { flex: 1; width: 100%; max-width: 520px; margin: 0 auto; display: flex; flex-direction: column; }
      .body { flex: 1; display: flex; flex-direction: column; padding: var(--space-2) var(--space-6) var(--space-6); }
      .body > :not(router-outlet) { flex: 1 1 auto; display: flex; flex-direction: column; }

      /* Desktop: a page header (logo left, controls right) over a centred card. */
      @media (min-width: 720px) {
        :host { background: var(--canvas); }
        .page { padding-bottom: var(--space-8); }
        .topbar { max-width: 1040px; margin: 0 auto; padding: var(--space-5) var(--space-6); }
        .back-phone { display: none; }
        .brand-logo { height: 34px; }
        .shell {
          flex: 0 0 auto; max-width: 480px; margin-top: var(--space-2);
        }
        .card-top { display: block; padding: var(--space-4) var(--space-6) 0; }
        .body { padding: var(--space-2) var(--space-6) var(--space-8); }
        .foot { padding: 0 var(--space-6) var(--space-6); }
      }
    `,
  ],
})
export class ApplyShellComponent {
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly showBack = computed(() => !NO_BACK_ROUTES.has(this.currentUrl().split('?')[0]));
}
