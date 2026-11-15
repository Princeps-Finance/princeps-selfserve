import { inject } from '@angular/core';
import type { NavigationError } from '@angular/router';
import { LangService } from '../i18n/lang.service';
import { ToastService } from '../toast/toast.service';

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Loading chunk [\w-]+ failed|ChunkLoadError|Importing a module script failed/i;

/** True when a screen's code could not be downloaded, usually because the app was updated while this page stayed open. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : typeof error === 'string' ? error : '';
  return CHUNK_ERROR.test(message);
}

/**
 * A tap that opens a screen whose code is out of date used to do nothing at all. Say so, and offer a reload,
 * which fetches the current version. Any other navigation error is left to fail as before.
 */
export function onNavigationError(e: NavigationError): void {
  if (!isChunkLoadError(e.error)) return;
  const lang = inject(LangService);
  inject(ToastService).error(lang.t('nav.stale'), {
    durationMs: 20_000,
    action: { label: lang.t('nav.reload'), run: () => window.location.reload() },
  });
}
