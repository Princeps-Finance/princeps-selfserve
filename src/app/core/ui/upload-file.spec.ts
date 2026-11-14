import { uploadWithRetry } from './upload-file';

/** A stand-in for XMLHttpRequest whose outcomes are listed in `results` (true: accepted, false: dropped). */
function fakeXhr(results: boolean[]) {
  const calls: string[] = [];
  class Fake {
    upload: { onprogress: ((e: unknown) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    status = 200;
    timeout = 0;
    open(_m: string, url: string) { calls.push(url); }
    setRequestHeader() { /* not needed */ }
    abort() { this.onabort?.(); }
    send() {
      const ok = results.shift() ?? false;
      queueMicrotask(() => {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
        if (ok) this.onload?.(); else this.onerror?.();
      });
    }
  }
  vi.stubGlobal('XMLHttpRequest', Fake);
  return calls;
}

const file = new File([new Uint8Array(20_000)], 'a.jpg', { type: 'image/jpeg' });
const noPause = () => Promise.resolve();

describe('uploadWithRetry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports progress and finishes when the first try works', async () => {
    fakeXhr([true]);
    const seen: number[] = [];
    expect(await uploadWithRetry('https://u/1', file, (f) => seen.push(f), { pause: noPause })).toBe(true);
    expect(seen).toContain(0.5);
    expect(seen.at(-1)).toBe(1);
  });

  it('starts the file again after a dropped connection, and then succeeds', async () => {
    const calls = fakeXhr([false, false, true]);
    const tries: number[] = [];
    expect(await uploadWithRetry('https://u/2', file, () => undefined, { pause: noPause, onAttempt: (n) => tries.push(n) })).toBe(true);
    expect(calls).toHaveLength(3);
    expect(tries).toEqual([1, 2, 3]);
  });

  it('gives up after the last try', async () => {
    const calls = fakeXhr([false, false, false]);
    expect(await uploadWithRetry('https://u/3', file, () => undefined, { pause: noPause })).toBe(false);
    expect(calls).toHaveLength(3);
  });
});
