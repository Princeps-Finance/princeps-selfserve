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

const NO_BACK_ROUTES = new Set<string>([APPLY.root, `${APPLY.root}/`, APPLY.status, APPLY.welcomeBack]);

@Component({
  selector: 'app-apply-shell',
  imports: [RouterOutlet, LanguageMenuComponent, BackButtonComponent, ReadAloudComponent, ThemeToggleComponent, BrandLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <!-- Slim top bar. Phone: back chevron (or the logo on the first screens) + controls. Desktop: logo + controls, and the back chevron moves into the card. -->
      <header class="topbar">
        <div class="topbar-left">
          @if (showBack()) {
            <app-back-button class="back-phone" />
          }
          <app-brand-logo class="brand-logo" [class.brand-logo--desktop-only]="showBack()" />
        </div>
        <div class="topbar-right">
          <app-read-aloud />
          <app-theme-toggle />
          <app-language-menu />
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
      :host { display: block; min-height: 100dvh; background: var(--surface-0); color: var(--ink); }
      .page { min-height: 100dvh; display: flex; flex-direction: column; }
      .topbar {
        display: flex; align-items: center; justify-content: space-between;
        width: 100%; box-sizing: border-box; padding: var(--space-2) var(--space-4); min-height: 56px;
      }
      .topbar-left { display: inline-flex; align-items: center; gap: var(--space-2); min-height: 44px; }
      .topbar-right { display: inline-flex; align-items: center; gap: var(--space-1); }
      .brand-logo { height: 30px; width: auto; display: block; }
      .brand-logo--desktop-only { display: none; }
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
        .brand-logo--desktop-only { display: block; }
        .brand-logo { height: 34px; }
        .shell {
          flex: 0 0 auto; max-width: 480px; margin-top: var(--space-2); background: var(--surface-0);
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
