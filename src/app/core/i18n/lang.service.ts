import { Injectable, computed, effect, signal } from '@angular/core';
import { Lang, TRANSLATIONS } from './translations';

const DEFAULT_LANG: Lang = 'en';
const KEY = 'princeps.lang';
const isLang = (v: unknown): v is Lang => v === 'en' || v === 'yo' || v === 'ig' || v === 'ha';

function saved(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly initial = saved();
  private readonly _lang = signal<Lang>(this.initial ?? DEFAULT_LANG);
  readonly lang = this._lang.asReadonly();
  /** True once the customer picked a language, on an earlier visit too. */
  readonly hasChosen = signal(this.initial !== null);

  private readonly dict = computed(() => TRANSLATIONS[this._lang()]);

  constructor() {
    effect(() => {
      const l = this._lang();
      if (typeof document !== 'undefined') document.documentElement.lang = l;
    });
  }

  set(lang: Lang): void {
    this._lang.set(lang);
    this.hasChosen.set(true);
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* storage unavailable: the choice lasts for this visit only */
    }
  }

  t(key: string): string {
    return this.dict()[key] ?? TRANSLATIONS.en[key] ?? key;
  }
}
