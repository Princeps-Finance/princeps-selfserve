import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'princeps.theme';

function read(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
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
  private readonly systemDark = signal(typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  /** What is actually showing: the forced theme, or the device setting. */
  readonly effective = computed<'light' | 'dark'>(() => {
    const m = this.mode();
    return m === 'system' ? (this.systemDark() ? 'dark' : 'light') : m;
  });

  constructor() {
    if (typeof matchMedia !== 'undefined') {
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => this.systemDark.set(e.matches));
    }
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
