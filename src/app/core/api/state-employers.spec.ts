import { DEFAULT_STATE_GOVERNMENTS, sanitizeStateGovernments } from './state-employers';

describe('state employers', () => {
  it('ships the served states, with Adamawa PHCDA collected through Dedukt', () => {
    const names = DEFAULT_STATE_GOVERNMENTS.map((s) => s.name).sort();
    expect(names).toEqual(['Adamawa', 'Cross River', 'Delta', 'Gombe', 'Katsina', 'Ondo', 'Plateau']);
    const adamawa = DEFAULT_STATE_GOVERNMENTS.find((s) => s.code === 'adamawa');
    expect(adamawa?.employers.map((e) => e.name)).toEqual(['Adamawa SUBEB', 'Adamawa LGA', 'Adamawa PHCDA']);
    expect(adamawa?.employers.find((e) => e.code === 'adamawa-phcda')?.channel).toBe('dedukt');
  });

  it('keeps a good list and an employer inherits the state channel when it names none', () => {
    const out = sanitizeStateGovernments([
      { code: 'x', name: 'X', channel: 'ippis', employers: [{ code: 'x1', name: 'X One' }, { code: 'x2', name: 'X Two', channel: 'dedukt' }] },
    ]);
    expect(out).toEqual([
      { code: 'x', name: 'X', channel: 'ippis', employers: [{ code: 'x1', name: 'X One', channel: 'ippis' }, { code: 'x2', name: 'X Two', channel: 'dedukt' }] },
    ]);
  });

  it('drops broken rows, repeats and unknown channels', () => {
    const out = sanitizeStateGovernments([
      null,
      { code: '', name: 'No code' },
      { code: 'a', name: 'A', channel: 'bitcoin' },
      { code: 'a', name: 'A again' },
      { code: 'b', name: 'B', employers: [{ code: 'e', name: 'E' }, { code: 'e', name: 'E again' }, 7] },
    ]);
    expect(out?.map((s) => [s.code, s.channel, s.employers.length])).toEqual([['a', 'remita', 0], ['b', 'remita', 1]]);
  });

  it('says nothing usable arrived, so the app keeps its own list', () => {
    expect(sanitizeStateGovernments(undefined)).toBeNull();
    expect(sanitizeStateGovernments([])).toBeNull();
    expect(sanitizeStateGovernments([{ nope: true }])).toBeNull();
  });
});
