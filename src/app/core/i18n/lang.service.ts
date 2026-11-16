import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { applicationEnglish } from './dictionaries/application.en';
import { english } from './dictionaries/en';
import type { Dictionary } from './dictionaries/dictionary';
import { type Lang, loadTranslation } from './translations';

const LANGUAGE_STORAGE_KEY = 'princeps.lang';

function readSavedLanguage(): Lang | null {
  try {
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (
      savedLanguage === 'en' ||
      savedLanguage === 'yo' ||
      savedLanguage === 'ig' ||
      savedLanguage === 'ha'
    ) {
      return savedLanguage;
    }
  } catch {
    // A browser can disable local storage.
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly document = inject(DOCUMENT);
  private readonly destroy = inject(DestroyRef);
  private readonly savedLanguage = readSavedLanguage();
  private readonly locale = signal<{ language: Lang; dictionary: Dictionary }>({
    language: 'en',
    dictionary: english,
  });
  readonly lang = () => this.locale().language;
  readonly hasChosen = signal(this.savedLanguage !== null);
  private requestId = 0;

  async restoreLanguage(): Promise<void> {
    if (this.savedLanguage && !(await this.applyLanguage(this.savedLanguage))) {
      this.hasChosen.set(false);
    }
  }

  async set(language: Lang): Promise<boolean> {
    if (!(await this.applyLanguage(language))) return false;
    this.hasChosen.set(true);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The choice is still available for this visit.
    }
    return true;
  }

  t(key: string): string {
    return this.locale().dictionary[key] ?? english[key] ?? applicationEnglish[key] ?? key;
  }

  private async applyLanguage(language: Lang): Promise<boolean> {
    const requestId = ++this.requestId;
    let dictionary: Dictionary;
    try {
      dictionary =
        this.lang() === language
          ? this.locale().dictionary
          : language === 'en'
            ? english
            : await loadTranslation[language]();
    } catch {
      return false;
    }

    if (this.destroy.destroyed || this.requestId !== requestId) return false;
    this.locale.set({ language, dictionary });
    this.document.documentElement.lang = language;
    return true;
  }
}
