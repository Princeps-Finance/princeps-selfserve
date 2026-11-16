import { isDevMode } from '@angular/core';

/** The public origin supplied to ngx-env by the host. */
export function apiOrigin(): string {
  const value = import.meta.env?.NG_APP_API_BASE_URL?.trim();
  if (!value) throw new Error('Set NG_APP_API_BASE_URL to the backend origin.');

  const url = new URL(value);
  const localDevelopment =
    isDevMode() && url.protocol === 'http:' && url.hostname === 'localhost';
  if (
    (!localDevelopment && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('NG_APP_API_BASE_URL must be a secure origin.');
  }

  return url.origin;
}
