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
      import('./features/apply/apply-shell.component').then(
        (routeModule) => routeModule.ApplyShellComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'welcome' },
      {
        path: 'welcome',
        loadComponent: () =>
          import('./features/apply/welcome/welcome.component').then(
            (routeModule) => routeModule.WelcomeIntentComponent,
          ),
      },
      ...(['employment', 'state', 'salary'] as const).map((page) => ({
        path: `check/${page}`,
        data: { page },
        loadComponent: () =>
          import('./features/apply/check/check-flow.component').then(
            (routeModule) => routeModule.CheckFlowComponent,
          ),
      })),
      {
        path: 'check-result',
        loadComponent: () =>
          import('./features/apply/check/check-result.component').then(
            (routeModule) => routeModule.CheckResultComponent,
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
      {
        path: 'resume',
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/resume/resume.component').then(
            (routeModule) => routeModule.ResumeComponent,
          ),
      },
      {
        path: 'saved',
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/saved/saved.component').then(
            (routeModule) => routeModule.SavedComponent,
          ),
      },
      {
        path: 'loans',
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/loans/loans.component').then(
            (routeModule) => routeModule.LoansComponent,
          ),
      },
      {
        path: 'loans/:id',
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/loans/loan-detail.component').then(
            (routeModule) => routeModule.LoanDetailComponent,
          ),
      },
      {
        path: 'state',
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/state/state.component').then(
            (routeModule) => routeModule.StateComponent,
          ),
      },
      {
        path: 'statement',
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/statement/statement.component').then(
            (routeModule) => routeModule.StatementComponent,
          ),
      },
      {
        path: 'waitlist',
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/waitlist/waitlist.component').then(
            (routeModule) => routeModule.WaitlistComponent,
          ),
      },
      {
        path: 'nin',
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/nin/nin.component').then(
            (routeModule) => routeModule.NinComponent,
          ),
      },
      ...['profile', 'employment', 'salary'].map((page) => ({
        path: page,
        data: { page },
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/details/details.component').then(
            (routeModule) => routeModule.DetailsComponent,
          ),
      })),
      ...['eligibility', 'offers', 'terms'].map((page) => ({
        path: page,
        data: { page },
        canMatch: [verifiedGuard],
        loadComponent: () =>
          import('./features/apply/offers/offers.component').then(
            (routeModule) => routeModule.OffersComponent,
          ),
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
