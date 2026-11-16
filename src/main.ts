import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
bootstrapApplication(App, appConfig).catch((error: unknown) => {
  console.error(error);
  showError();
});

function showError() {
  const host = document.querySelector('app-root');
  if (host)
    host.textContent = 'The application could not start. Please refresh or contact support.';
}
