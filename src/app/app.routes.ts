import { Routes } from '@angular/router';
import {
  languageChosenGuard,
  languageNotChosenGuard,
  requiresApprovedGuard,
  requiresBvnEnteredGuard,
  requiresBvnGuard,
  requiresContactGuard,
  requiresDocumentsGuard,
  requiresCheckResultGuard,
  requiresEmploymentGuard,
  requiresIdentityOrCheckGuard,
  requiresIdentityVerificationGuard,
  requiresMandateGuard,
  requiresNotSubmittedGuard,
  requiresNinIfNeededGuard,
  requiresOfferGuard,
  requiresPhoneVerifiedGuard,
  requiresProfileGuard,
  requiresReceivedGuard,
  requiresSalaryGuard,
  requiresTermsGuard,
} from './core/flow/guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [languageNotChosenGuard],
    loadComponent: () =>
      import('./features/language-select/language-select.component').then(
        (m) => m.LanguageSelectComponent,
      ),
  },
  {
    path: 'apply',
    canMatch: [languageChosenGuard],
    loadComponent: () =>
      import('./features/apply/apply-shell.component').then((m) => m.ApplyShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'welcome' },
      {
        path: 'welcome',
        loadComponent: () =>
          import('./features/apply/welcome/welcome.component').then((m) => m.WelcomeIntentComponent),
      },
      // Old links: the phone-and-email screen is gone, the BVN is the first question.
      { path: 'contact', pathMatch: 'full', redirectTo: 'bvn' },
      {
        path: 'verify',
        canMatch: [requiresBvnEnteredGuard],
        loadComponent: () =>
          import('./features/apply/verify-phone/verify-phone.component').then(
            (m) => m.VerifyPhoneComponent,
          ),
      },
      {
        path: 'resume',
        canMatch: [requiresContactGuard, requiresPhoneVerifiedGuard],
        loadComponent: () =>
          import('./features/apply/resume/resume.component').then((m) => m.ResumeComponent),
      },
      {
        path: 'saved',
        canMatch: [requiresApprovedGuard],
        loadComponent: () =>
          import('./features/apply/saved/saved.component').then((m) => m.SavedComponent),
      },
      {
        path: 'loans',
        canMatch: [requiresContactGuard, requiresPhoneVerifiedGuard],
        loadComponent: () =>
          import('./features/apply/loans/loans.component').then((m) => m.LoansComponent),
      },
      {
        path: 'loans/:id',
        canMatch: [requiresContactGuard, requiresPhoneVerifiedGuard],
        loadComponent: () =>
          import('./features/apply/loans/loan-detail.component').then((m) => m.LoanDetailComponent),
      },
      {
        path: 'employment',
        canMatch: [requiresIdentityOrCheckGuard],
        loadComponent: () =>
          import('./features/apply/employment/employment.component').then(
            (m) => m.EmploymentComponent,
          ),
      },
      {
        path: 'waitlist',
        canMatch: [requiresContactGuard, requiresPhoneVerifiedGuard],
        loadComponent: () =>
          import('./features/apply/waitlist/waitlist.component').then((m) => m.WaitlistComponent),
      },
      {
        path: 'salary',
        canMatch: [requiresEmploymentGuard],
        loadComponent: () =>
          import('./features/apply/salary/salary.component').then((m) => m.SalaryComponent),
      },
      {
        path: 'statement',
        canMatch: [requiresIdentityOrCheckGuard, requiresEmploymentGuard],
        loadComponent: () =>
          import('./features/apply/statement/statement.component').then((m) => m.StatementComponent),
      },
      {
        path: 'bvn',
        loadComponent: () =>
          import('./features/apply/bvn/bvn.component').then((m) => m.BvnComponent),
      },
      {
        path: 'nin',
        canMatch: [requiresOfferGuard, requiresBvnGuard],
        loadComponent: () =>
          import('./features/apply/nin/nin.component').then((m) => m.NinComponent),
      },
      {
        path: 'profile',
        canMatch: [requiresContactGuard, requiresPhoneVerifiedGuard],
        loadComponent: () =>
          import('./features/apply/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'eligibility',
        canMatch: [requiresEmploymentGuard, requiresSalaryGuard],
        loadComponent: () =>
          import('./features/apply/eligibility/eligibility.component').then(
            (m) => m.EligibilityComponent,
          ),
      },
      {
        path: 'check-result',
        canMatch: [requiresCheckResultGuard],
        loadComponent: () =>
          import('./features/apply/check-result/check-result.component').then((m) => m.CheckResultComponent),
      },
      {
        path: 'offers',
        canMatch: [requiresEmploymentGuard, requiresSalaryGuard, requiresApprovedGuard],
        loadComponent: () =>
          import('./features/apply/offers/offers.component').then((m) => m.OffersComponent),
      },
      {
        path: 'terms',
        canMatch: [requiresApprovedGuard, requiresOfferGuard],
        loadComponent: () =>
          import('./features/apply/terms/terms.component').then((m) => m.TermsComponent),
      },
      {
        path: 'offer-letter',
        canMatch: [requiresOfferGuard, requiresDocumentsGuard],
        loadComponent: () =>
          import('./features/apply/offer-letter-step/offer-letter-step.component').then((m) => m.OfferLetterStepComponent),
      },
      {
        path: 'mandate',
        canMatch: [requiresOfferGuard, requiresDocumentsGuard, requiresTermsGuard],
        loadComponent: () =>
          import('./features/apply/mandate/mandate.component').then((m) => m.MandateComponent),
      },
      {
        path: 'documents',
        canMatch: [requiresApprovedGuard, requiresOfferGuard, requiresNinIfNeededGuard],
        loadComponent: () =>
          import('./features/apply/documents/documents.component').then(
            (m) => m.DocumentsComponent,
          ),
      },
      {
        path: 'verify-identity',
        canMatch: [requiresNinIfNeededGuard, requiresDocumentsGuard, requiresMandateGuard],
        loadComponent: () =>
          import('./features/apply/verify-identity/verify-identity.component').then(
            (m) => m.VerifyIdentityComponent,
          ),
      },
      {
        path: 'submit',
        canMatch: [requiresNotSubmittedGuard, requiresBvnGuard, requiresOfferGuard, requiresMandateGuard, requiresIdentityVerificationGuard],
        loadComponent: () =>
          import('./features/apply/submit/submit.component').then((m) => m.SubmitComponent),
      },
      {
        path: 'status',
        canMatch: [requiresReceivedGuard],
        loadComponent: () =>
          import('./features/apply/status/status.component').then((m) => m.StatusComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
