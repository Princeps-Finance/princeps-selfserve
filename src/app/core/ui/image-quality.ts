/**
 * A quick check, on the customer's phone, that a photo of a document is sharp and lit well enough to read.
 * It catches the common bad photos (out of focus, too dark) before they are sent, so the customer retakes it
 * now instead of being asked again a day later. It does not read the document; it only judges the picture.
 */
export type ImageQuality = 'ok' | 'blurry' | 'dark' | 'too-small';

/** Under this many pixels on the short side, small print on a payslip or ID is not readable. */
const MIN_SHORT_SIDE = 600;
/** A sharp page has strong edges everywhere; a blurred one does not. Tuned on phone photos of documents: adjust with real ones. */
const MIN_SHARPNESS = 60;
const MIN_BRIGHTNESS = 55;
const SAMPLE_SIDE = 720;

/** Mean brightness 0 to 255. */
export function meanBrightness(gray: Uint8ClampedArray | number[]): number {
  if (gray.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return sum / gray.length;
}

/** The variance of the Laplacian: the usual measure of focus. High means sharp edges, low means blurred. */
export function laplacianVariance(gray: Uint8ClampedArray | number[], w: number, h: number): number {
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Judges grey pixels already read from a picture. Kept apart from the browser so it can be tested. */
export function judgeQuality(gray: Uint8ClampedArray | number[], w: number, h: number): ImageQuality {
  if (meanBrightness(gray) < MIN_BRIGHTNESS) return 'dark';
  if (laplacianVariance(gray, w, h) < MIN_SHARPNESS) return 'blurry';
  return 'ok';
}

/**
 * Looks at a photo the way the customer would. A PDF, or a format this browser cannot draw (some HEIC files),
 * is not judged: it passes, because a wrong "retake" is worse than a missed one.
 */
export async function checkImageQuality(file: File): Promise<ImageQuality> {
  if (!file.type.startsWith('image/')) return 'ok';
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    if (Math.min(width, height) < MIN_SHORT_SIDE) {
      bitmap.close?.();
      return 'too-small';
    }
    const scale = Math.min(1, SAMPLE_SIDE / Math.max(width, height));
    const w = Math.max(3, Math.round(width * scale));
    const h = Math.max(3, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      bitmap.close?.();
      return 'ok';
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
    return judgeQuality(gray, w, h);
  } catch {
    return 'ok';
  }
}
