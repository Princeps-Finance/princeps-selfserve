import { Routes } from '@angular/router';
import {
  languageChosenGuard,
  languageNotChosenGuard,
  sessionGuard,
  verifiedGuard,
} from './app.guards';
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [languageNotChosenGuard],
    loadComponent: () =>
      import('./features/language-select/language-select.component').then(
        (routeModule) => routeModule.LanguageSelectComponent,
      ),
  },
  {
    path: 'apply',
    canMatch: [languageChosenGuard],
    loadComponent: () =>
      import('./features/apply/apply-shell.component').then((routeModule) => routeModule.ApplyShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'welcome' },
      {
        path: 'welcome',
        loadComponent: () =>
          import('./features/apply/welcome/welcome.component').then(
            (routeModule) => routeModule.WelcomeIntentComponent,
          ),
      },
      ...['bvn', 'verify'].map((page) => ({
        path: page,
        data: { page },
        canMatch: page === 'verify' ? [sessionGuard] : [],
        loadComponent: () =>
          import('./features/apply/verification/verification.component').then(
            (routeModule) => routeModule.VerificationComponent,
          ),
      })),
      ...['profile', 'employment', 'salary'].map((page) => ({
        path: page,
        data: { page },
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/details/details.component').then((routeModule) => routeModule.DetailsComponent),
      })),
      ...['eligibility', 'offers', 'terms'].map((page) => ({
        path: page,
        data: { page },
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/offers/offers.component').then((routeModule) => routeModule.OffersComponent),
      })),
      ...['documents', 'verify-identity', 'offer-letter', 'mandate', 'submit', 'status'].map(
        (page) => ({
          path: page,
          data: { page },
          canMatch: [verifiedGuard],
          loadComponent: () =>
            import('./features/apply/completion/completion.component').then(
              (routeModule) => routeModule.CompletionComponent,
            ),
        }),
      ),
      { path: '**', redirectTo: 'welcome' },
    ],
  },
  { path: '**', redirectTo: '' },
];
