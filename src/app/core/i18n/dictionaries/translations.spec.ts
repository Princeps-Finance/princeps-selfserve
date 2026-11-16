import { english } from './en';
import { hausa } from './ha';
import { igbo } from './ig';
import { yoruba } from './yo';

/** Strings that are the same in every language on purpose: the brand, amounts and product names. */
const SAME_EVERYWHERE = new Set([
  'apply.brand',
  'step.mandate.channel.ippis',
  'step.mandate.channel.remita',
  'step.mandate.channel.dedukt',
]);

describe.each([
  ['Yoruba', yoruba],
  ['Igbo', igbo],
  ['Hausa', hausa],
])('%s dictionary', (_name, dictionary) => {
  it('has every key', () => {
    expect(Object.keys(english).filter((key) => !(key in dictionary))).toEqual([]);
  });

  it('has no sentence left in English', () => {
    const left = Object.keys(english).filter(
      (key) =>
        english[key] === dictionary[key] && english[key].length > 3 && !SAME_EVERYWHERE.has(key),
    );
    expect(left).toEqual([]);
  });

  it('keeps every {placeholder} the English text has', () => {
    const holders = (message: string) => (message.match(/\{\w+\}/g) ?? []).sort().join();
    const bad = Object.keys(english).filter(
      (key) => holders(english[key]) !== holders(dictionary[key] ?? ''),
    );
    expect(bad).toEqual([]);
  });
});
