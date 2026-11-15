import { en } from './en';
import { ha } from './ha';
import { ig } from './ig';
import { yo } from './yo';

/** Strings that are the same in every language on purpose: the brand, amounts and product names. */
const SAME_EVERYWHERE = new Set([
  'apply.brand',
  'waitlist.income.100to250k',
  'waitlist.income.250to500k',
  'waitlist.income.500to1m',
  'waitlist.channel.whatsapp',
  'step.mandate.channel.ippis',
  'step.mandate.channel.remita',
  'step.mandate.channel.dedukt',
]);

describe.each([
  ['Yoruba', yo],
  ['Igbo', ig],
  ['Hausa', ha],
])('%s dictionary', (_name, dict) => {
  it('has every key', () => {
    expect(Object.keys(en).filter((k) => !(k in dict))).toEqual([]);
  });

  it('has no sentence left in English', () => {
    const left = Object.keys(en).filter((k) => (en as Record<string, string>)[k] === (dict as Record<string, string>)[k] && (en as Record<string, string>)[k].length > 3 && !SAME_EVERYWHERE.has(k));
    expect(left).toEqual([]);
  });

  it('keeps every {placeholder} the English text has', () => {
    const holders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const bad = Object.keys(en).filter((k) => holders((en as Record<string, string>)[k]) !== holders((dict as Record<string, string>)[k] ?? ''));
    expect(bad).toEqual([]);
  });
});
