import { TestBed } from '@angular/core/testing';
import { LangService } from './lang.service';

describe('LangService', () => {
  afterEach(() => {
    localStorage.removeItem('princeps.lang');
    document.documentElement.lang = 'en';
  });

  it('loads a saved language before showing the application', async () => {
    localStorage.setItem('princeps.lang', 'yo');
    const language = TestBed.inject(LangService);
    await language.restoreLanguage();
    expect(language.lang()).toBe('yo');
    expect(document.documentElement.lang).toBe('yo');
    expect(language.t('common.close')).not.toBe('Close');
  });

  it('does not apply a late language download over a newer selection', async () => {
    const language = TestBed.inject(LangService);
    const previousSelection = language.set('ig');
    await language.set('en');
    expect(await previousSelection).toBe(false);
    expect(language.lang()).toBe('en');
    expect(localStorage.getItem('princeps.lang')).toBe('en');
  });
});
