import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { LanguageMenuComponent } from './language-menu.component';
import { BackButtonComponent } from './back-button.component';
import { ReadAloudComponent } from './read-aloud.component';

const NO_BACK_ROUTES = new Set<string>([
  '/apply',
  '/apply/',
  '/apply/contact',
  '/apply/eligibility',
  '/apply/status',
]);

@Component({
  selector: 'app-apply-shell',
  imports: [RouterOutlet, LanguageMenuComponent, BackButtonComponent, ReadAloudComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <header class="topbar">
        <div class="topbar-left">
          @if (showBack()) {
            <app-back-button />
          } @else {
            <img class="brand-logo" src="/princeps-logo.png" alt="Princeps Credit Systems Limited" width="150" height="34" />
          }
        </div>
        <div class="topbar-right">
          <app-read-aloud />
          <app-language-menu />
        </div>
      </header>

      <main class="body">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      :host { display: block; min-height: 100dvh; background: var(--canvas); color: var(--ink); }
      .shell {
        max-width: 520px; margin: 0 auto; min-height: 100dvh;
        display: flex; flex-direction: column;
      }
      .topbar {
        display: flex; align-items: center; justify-content: space-between;
        padding: var(--space-5) var(--space-6);
        min-height: 68px;
      }
      .topbar-left { display: inline-flex; align-items: center; min-height: 44px; }
      .topbar-right { display: inline-flex; align-items: center; gap: var(--space-3); }
      .brand-logo { height: 32px; width: auto; display: block; }
      .brand { display: inline-flex; align-items: center; gap: 10px; }
      .brand-mark { display: inline-flex; gap: 3px; align-items: center; }
      .dot { width: 8px; height: 8px; border-radius: 50%; }
      .dot--navy { background: var(--navy-900); }
      .dot--cyan { background: var(--cyan-500); }
      .dot--orange { background: var(--orange-500); }
      .brand-name {
        font-family: var(--font-display);
        font-weight: 600; font-size: 15px; letter-spacing: -0.01em;
        color: var(--ink);
      }
      .body {
        flex: 1;
        padding: var(--space-4) var(--space-6) calc(var(--space-20) + var(--space-4) + env(safe-area-inset-bottom));
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
