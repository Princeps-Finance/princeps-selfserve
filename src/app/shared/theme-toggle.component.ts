import { IconComponent } from './icon.component';
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
  imports: [IconComponent],
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="toggle glass-btn" [attr.aria-label]="label()" [attr.title]="label()" (click)="next()">
      @switch (mode()) {
        @case ('light') { <app-icon name="bold-sun" [size]="20" /> }
        @case ('dark') { <app-icon name="bold-moon" [size]="20" /> }
        @default {
          <!-- Follows the device: Iconly has no matching glyph, so this half disc stays hand drawn. -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
          </svg>
        }
      }
    </button>
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .toggle {
        display: inline-flex; align-items: center; justify-content: center;
      }
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
