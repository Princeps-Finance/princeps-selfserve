import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ToastService } from '../core/toast/toast.service';
import { LangService } from '../core/i18n/lang.service';
import { ThemeMode, ThemeService } from '../core/theme/theme.service';

const ORDER: readonly ThemeMode[] = ['system', 'light', 'dark'];

/**
 * Colour theme: follows the device (day or night) until the visitor picks light or dark. One tap moves to the
 * next choice, and a short message says which one is on, so the three states are never a guess.
 */
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="toggle" [attr.aria-label]="label()" [attr.title]="label()" (click)="next()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        @switch (mode()) {
          @case ('light') {
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          }
          @case ('dark') {
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
          }
          @default {
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
          }
        }
      </svg>
    </button>
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .toggle {
        display: inline-flex; align-items: center; justify-content: center;
        width: 44px; height: 44px; border: 0; border-radius: 50%;
        background: transparent; color: var(--ink); cursor: pointer;
        transition: background var(--dur-base) ease;
      }
      .toggle:hover { background: var(--hover-tint); }
      .toggle:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
      @media (prefers-reduced-motion: reduce) { .toggle { transition: none; } }
    `,
  ],
})
export class ThemeToggleComponent {
  private readonly theme = inject(ThemeService);
  private readonly lang = inject(LangService);
  private readonly toast = inject(ToastService);

  protected readonly mode = this.theme.mode;
  private readonly modeName = (m: ThemeMode): string => this.lang.t(`theme.${m}`);
  protected readonly label = computed(() => `${this.lang.t('theme.label')}: ${this.modeName(this.mode())}`);

  protected next(): void {
    const upcoming = ORDER[(ORDER.indexOf(this.mode()) + 1) % ORDER.length];
    this.theme.set(upcoming);
    this.toast.info(`${this.lang.t('theme.label')}: ${this.modeName(upcoming)}`, { durationMs: 2_500 });
  }
}
