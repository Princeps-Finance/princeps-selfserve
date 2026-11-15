import { isChunkLoadError } from './chunk-error';

describe('isChunkLoadError', () => {
  it('knows the messages browsers give when a screen cannot be downloaded', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: http://x/chunk-ABC.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 12 failed.'))).toBe(true);
    const e = new Error('boom');
    e.name = 'ChunkLoadError';
    expect(isChunkLoadError(e)).toBe(true);
  });

  it('leaves every other error alone', () => {
    expect(isChunkLoadError(new Error('Cannot match any routes'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
