import type { Dictionary } from './dictionaries/dictionary';

export type Lang = 'en' | 'yo' | 'ig' | 'ha';

export const LANGUAGES: readonly { code: Lang; endonym: string; english: string; hello: string }[] =
  [
    { code: 'en', endonym: 'English', english: 'English', hello: 'Hello' },
    { code: 'yo', endonym: 'Yorùbá', english: 'Yoruba', hello: 'Ẹ nlẹ́ o' },
    { code: 'ig', endonym: 'Igbo', english: 'Igbo', hello: 'Nnọọ' },
    { code: 'ha', endonym: 'Hausa', english: 'Hausa', hello: 'Sannu' },
  ] as const;

export const loadTranslation: Record<Exclude<Lang, 'en'>, () => Promise<Dictionary>> = {
  yo: () => import('./dictionaries/yo').then(({ yoruba }) => yoruba),
  ig: () => import('./dictionaries/ig').then(({ igbo }) => igbo),
  ha: () => import('./dictionaries/ha').then(({ hausa }) => hausa),
};
