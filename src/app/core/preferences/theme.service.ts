import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'princeps.theme';

function read(): ThemeMode {
  try {
    const storedTheme = localStorage.getItem(KEY);
    return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Light, dark or follow the device. "system" leaves the attribute off so the CSS media query decides;
 * light and dark force the matching token set (see styles/tokens.css).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(read());
  private readonly prefersDark =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined;
  private readonly systemDark = signal(this.prefersDark?.matches ?? false);
  /** What is actually showing: the forced theme, or the device setting. */
  readonly effective = computed<'light' | 'dark'>(() => {
    const mode = this.mode();
    return mode === 'system' ? (this.systemDark() ? 'dark' : 'light') : mode;
  });

  constructor() {
    const onPreferenceChange = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
    this.prefersDark?.addEventListener('change', onPreferenceChange);
    inject(DestroyRef).onDestroy(() =>
      this.prefersDark?.removeEventListener('change', onPreferenceChange),
    );
    effect(() => {
      const mode = this.mode();
      const root = document.documentElement;
      if (mode === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', mode);
      try {
        if (mode === 'system') localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, mode);
      } catch {
        /* storage unavailable: applies for this visit only */
      }
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }
}
