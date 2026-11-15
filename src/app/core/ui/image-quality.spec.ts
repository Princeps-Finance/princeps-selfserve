import { judgeQuality, laplacianVariance, meanBrightness } from './image-quality';

const W = 40;
const H = 40;
const flat = (v: number) => new Uint8ClampedArray(W * H).fill(v);
/** Black and white stripes: strong edges, like crisp print. */
const stripes = () => {
  const g = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = x % 2 === 0 ? 230 : 120;
  return g;
};

describe('image quality', () => {
  it('measures brightness', () => {
    expect(meanBrightness(flat(100))).toBe(100);
    expect(meanBrightness([])).toBe(0);
  });

  it('finds no edges in a flat picture and many in a crisp one', () => {
    expect(laplacianVariance(flat(150), W, H)).toBe(0);
    expect(laplacianVariance(stripes(), W, H)).toBeGreaterThan(1000);
  });

  it('passes a bright, crisp photo', () => {
    expect(judgeQuality(stripes(), W, H)).toBe('ok');
  });

  it('calls a flat bright picture blurry and a dim one dark', () => {
    expect(judgeQuality(flat(200), W, H)).toBe('blurry');
    expect(judgeQuality(flat(20), W, H)).toBe('dark');
  });
});
