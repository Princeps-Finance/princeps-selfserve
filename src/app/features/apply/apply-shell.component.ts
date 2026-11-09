import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { LanguageMenuComponent } from './language-menu.component';
import { BackButtonComponent } from './back-button.component';
import { ReadAloudComponent } from './read-aloud.component';
import { HelpLauncherComponent } from './help-launcher.component';
import { TPipe } from '../../core/i18n/t.pipe';
import { PrivacyService } from '../../core/privacy/privacy.service';

const NO_BACK_ROUTES = new Set<string>([
  '/apply',
  '/apply/',
  '/apply/welcome',
  '/apply/saved',
  '/apply/contact',
  '/apply/eligibility',
  '/apply/status',
]);

@Component({
  selector: 'app-apply-shell',
  imports: [RouterOutlet, LanguageMenuComponent, BackButtonComponent, ReadAloudComponent, HelpLauncherComponent, TPipe],
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
          <app-help-launcher />
          <app-language-menu />
        </div>
      </header>

      <main class="body">
        <router-outlet />
      </main>

      <footer class="foot">
        <p class="foot-trust">{{ 'trust.cbn' | t }}</p>
        <button type="button" class="foot-link" (click)="privacy.open()">{{ 'consent.link' | t }}</button>
      </footer>
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
      .foot { padding: 0 var(--space-6) calc(var(--space-6) + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); }
      .foot-trust { margin: 0; font-size: 12px; color: var(--ink-muted); }
      .foot-link { min-height: 44px; padding: 0; border: 0; background: none; color: var(--ink-soft); font: inherit; font-size: 13px; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
      .body {
        flex: 1;
        padding: var(--space-4) var(--space-6) var(--space-8);
      }
    `,
  ],
})
export class ApplyShellComponent {
  private readonly router = inject(Router);
  protected readonly privacy = inject(PrivacyService);

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
