/** What the customer's file is, checked and shrunk on their phone before anything is sent. */
export type PreparedUpload =
  | { ok: true; file: File; shrunk: boolean }
  | { ok: false; reason: 'bad-type' | 'too-small' };

const ACCEPTED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i;
/** Under this a file cannot hold a readable page. */
const MIN_BYTES = 8 * 1024;
/** Photos above this are shrunk; most phone cameras make 3 to 8 MB pictures that a back office does not need. */
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 1800;

/**
 * Checks the type and size, and shrinks a large photo to a sensible JPEG. A PDF, a small photo, or a format this
 * browser cannot draw (some HEIC files) goes through unchanged.
 */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  const type = file.type || guessType(file.name);
  if (!ACCEPTED.test(type)) return { ok: false, reason: 'bad-type' };
  if (file.size < MIN_BYTES) return { ok: false, reason: 'too-small' };
  if (!type.startsWith('image/') || file.size <= SHRINK_ABOVE_BYTES) return { ok: true, file, shrunk: false };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return { ok: true, file, shrunk: false };
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return { ok: true, file: new File([blob], name, { type: 'image/jpeg' }), shrunk: true };
  } catch {
    return { ok: true, file, shrunk: false };
  }
}

function guessType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return '';
}
