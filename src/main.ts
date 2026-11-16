import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { APP_CONFIG, readConfiguration } from './app/runtime-config';
try {
  const config = readConfiguration();
  bootstrapApplication(App, {
    providers: [...appConfig.providers, { provide: APP_CONFIG, useValue: config }],
  }).catch(() => showError());
} catch {
  showError();
}
function showError() {
  const host = document.querySelector('app-root');
  if (host)
    host.textContent = 'The application could not start. Please refresh or contact support.';
}
