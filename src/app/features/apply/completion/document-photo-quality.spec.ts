import { assessGrayscale } from './document-photo-quality';

describe('document photo quality', () => {
  it('distinguishes dark and blurry samples from a well-lit sample with clear edges', () => {
    const dark = new Uint8ClampedArray(25).fill(25);
    const blurry = new Uint8ClampedArray(25).fill(150);
    const sharp = Uint8ClampedArray.from({ length: 25 }, (_, index) => (index % 2 ? 200 : 30));
    expect(assessGrayscale(dark, 5, 5)).toBe('dark');
    expect(assessGrayscale(blurry, 5, 5)).toBe('blurry');
    expect(assessGrayscale(sharp, 5, 5)).toBeNull();
  });
});
