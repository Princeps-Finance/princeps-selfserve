import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { API_CLIENT } from './core/api/api-client';
import { MockApiClient } from './core/api/mock-api-client';
import { HttpApiClient } from './core/api/http-api-client';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Every new screen opens at the top. Without this a screen opened halfway down, where the previous one was scrolled.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // Production only. Waits for the app to settle so the first paint is never delayed.
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerImmediately',
    }),
    { provide: API_CLIENT, useExisting: environment.useMockApi ? MockApiClient : HttpApiClient },
  ],
};
