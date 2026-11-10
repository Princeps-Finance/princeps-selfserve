import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { API_CLIENT } from './core/api/api-client';
import { MockApiClient } from './core/api/mock-api-client';
import { HttpApiClient } from './core/api/http-api-client';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Production only. Waits for the app to settle so the first paint is never delayed.
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: API_CLIENT, useExisting: environment.useMockApi ? MockApiClient : HttpApiClient },
  ],
};
