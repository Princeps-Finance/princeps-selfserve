import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { API_CLIENT, MockApiClient } from './core/api/api-client';
import { HttpApiClient } from './core/api/http-api-client';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: API_CLIENT, useExisting: environment.useMockApi ? MockApiClient : HttpApiClient },
  ],
};
