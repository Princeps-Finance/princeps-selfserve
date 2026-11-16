export type PhotoWarning = 'blurry' | 'dark' | 'too-small';

const MIN_SIDE = 600;
const SAMPLE_SIDE = 720;

export function assessGrayscale(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): PhotoWarning | null {
  const brightness = pixels.reduce((sum, pixel) => sum + pixel, 0) / pixels.length;
  if (brightness < 55) return 'dark';

  let total = 0;
  let squares = 0;
  let count = 0;
  for (let row = 1; row < height - 1; row++) {
    for (let column = 1; column < width - 1; column++) {
      const index = row * width + column;
      const edge =
        4 * pixels[index] -
        pixels[index - 1] -
        pixels[index + 1] -
        pixels[index - width] -
        pixels[index + width];
      total += edge;
      squares += edge * edge;
      count++;
    }
  }
  const variance = squares / count - (total / count) ** 2;
  return variance < 60 ? 'blurry' : null;
}

export async function inspectDocumentPhoto(file: File): Promise<PhotoWarning | null> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return null;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    if (Math.min(bitmap.width, bitmap.height) < MIN_SIDE) return 'too-small';
    const scale = Math.min(1, SAMPLE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(3, Math.round(bitmap.width * scale));
    canvas.height = Math.max(3, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const grayscale = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let pixel = 0; pixel < grayscale.length; pixel++) {
      const color = pixel * 4;
      grayscale[pixel] = 0.299 * data[color] + 0.587 * data[color + 1] + 0.114 * data[color + 2];
    }
    return assessGrayscale(grayscale, canvas.width, canvas.height);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
