import { describe, expect, it } from 'vitest';
import { readAsDataUrl } from './file-data-url';

describe('readAsDataUrl', () => {
  it('turns a blob into a data URL with its type', async () => {
    const url = await readAsDataUrl(new Blob(['hello'], { type: 'text/plain' }));
    expect(url.startsWith('data:text/plain;base64,')).toBe(true);
    expect(atob(url.split(',')[1])).toBe('hello');
  });
});
