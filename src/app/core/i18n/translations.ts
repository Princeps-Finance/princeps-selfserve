import { en } from './dictionaries/en';
import { ha } from './dictionaries/ha';
import { ig } from './dictionaries/ig';
import { yo } from './dictionaries/yo';
import type { Dictionary } from './dictionaries/dictionary';

export type Lang = 'en' | 'yo' | 'ig' | 'ha';

export const LANGUAGES: readonly { code: Lang; endonym: string; english: string; hello: string }[] = [
  { code: 'en', endonym: 'English', english: 'English', hello: 'Hello' },
  { code: 'yo', endonym: 'Yorùbá', english: 'Yoruba', hello: 'Ẹ nlẹ́ o' },
  { code: 'ig', endonym: 'Igbo', english: 'Igbo', hello: 'Nnọọ' },
  { code: 'ha', endonym: 'Hausa', english: 'Hausa', hello: 'Sannu' },
] as const;


export const TRANSLATIONS: Record<Lang, Dictionary> = { en, yo, ig, ha };
