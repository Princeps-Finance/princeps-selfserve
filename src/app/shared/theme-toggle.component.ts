import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService } from '../core/theme/theme.service';

/** Switches between light and dark. Starts from the device setting until the visitor chooses. */
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="toggle"
      role="switch"
      [attr.aria-checked]="isDark()"
      [attr.aria-label]="isDark() ? 'Dark mode on. Switch to light mode' : 'Light mode on. Switch to dark mode'"
      (click)="flip()"
    >
      @if (isDark()) {
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      } @else {
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      }
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
  protected readonly isDark = computed(() => this.theme.effective() === 'dark');

  protected flip(): void {
    this.theme.set(this.isDark() ? 'light' : 'dark');
  }
}
