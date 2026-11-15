/** One try at sending a file to its upload address, reporting how much has gone. Resolves true when the server accepted it. */
function putOnce(url: string, file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.ontimeout = () => resolve(false);
    xhr.onabort = () => resolve(false);
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/**
 * Sends a file to a one-time upload address with a progress bar. On a dropped connection it starts the file again,
 * up to three tries with a growing pause (a one-time address cannot resume half a file). `onAttempt` tells the screen
 * which try it is on. Resolves false only after the last try fails or the upload is cancelled.
 */
export async function uploadWithRetry(
  url: string,
  file: File,
  onProgress: (fraction: number) => void,
  options: { attempts?: number; signal?: AbortSignal; onAttempt?: (n: number) => void; pause?: (ms: number) => Promise<void> } = {},
): Promise<boolean> {
  const attempts = options.attempts ?? 3;
  const pause = options.pause ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let n = 1; n <= attempts; n++) {
    options.onAttempt?.(n);
    onProgress(0);
    if (await putOnce(url, file, onProgress, options.signal)) {
      onProgress(1);
      return true;
    }
    if (options.signal?.aborted || n === attempts) return false;
    await pause(800 * 2 ** (n - 1));
  }
  return false;
}
