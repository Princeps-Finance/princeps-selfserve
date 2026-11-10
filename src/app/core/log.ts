/**
 * One place for diagnostics. Only a short context and the error's name are written, never its message or any
 * request data, because the browser console is visible to whoever is using the device.
 */
export function logWarn(context: string, error?: unknown): void {
  console.warn(`[princeps] ${context}`, error instanceof Error ? error.name : '');
}
