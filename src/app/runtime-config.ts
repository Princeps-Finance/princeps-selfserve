import { InjectionToken } from '@angular/core';

export interface AppConfiguration {
  environment: 'development' | 'staging' | 'production';
  apiBaseUrl: string;
  accountsUrl: string;
}

export function validateConfiguration(
  environment: unknown,
  apiBaseUrl: string,
  accountsUrl = '',
): AppConfiguration {
  if (environment !== 'development' && environment !== 'staging' && environment !== 'production') {
    throw new Error('A deployment environment is required.');
  }
  const api = new URL(apiBaseUrl);
  const local =
    environment === 'development' && api.protocol === 'http:' && api.hostname === 'localhost';
  if (
    (!local && api.protocol !== 'https:') ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    api.pathname !== '/'
  ) {
    throw new Error('The API base URL must be a secure origin.');
  }
  if (environment === 'production' && api.hostname === 'self-service-apply.princeps.cloud') {
    throw new Error('Production cannot use the development API.');
  }
  if (accountsUrl && new URL(accountsUrl).protocol !== 'https:')
    throw new Error('Accounts URL must use HTTPS.');
  return { environment, apiBaseUrl: api.origin, accountsUrl };
}

export function readConfiguration(): AppConfiguration {
  return validateConfiguration(
    import.meta.env.NG_APP_ENVIRONMENT,
    import.meta.env.NG_APP_API_BASE_URL,
    import.meta.env.NG_APP_ACCOUNTS_URL,
  );
}

export const APP_CONFIG = new InjectionToken<AppConfiguration>('Frontend runtime settings');
