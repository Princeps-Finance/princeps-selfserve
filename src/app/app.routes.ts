import { inject } from '@angular/core';
import { CanMatchFn, Router, Routes } from '@angular/router';
import { LangService } from './core/i18n/lang.service';
import { ApplicationStateService } from './core/application/application-state.service';

const languageChosenGuard: CanMatchFn = () => {
  const lang = inject(LangService);
  const router = inject(Router);
  return lang.hasChosen() ? true : router.parseUrl('/');
};

const requiresContactGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.contact() ? true : router.parseUrl('/apply/contact');
};

const requiresPhoneVerifiedGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.phoneVerified() ? true : router.parseUrl('/apply/verify');
};

const requiresEmploymentGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.employment() ? true : router.parseUrl('/apply/employment');
};

const requiresSalaryGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.salary() ? true : router.parseUrl('/apply/salary');
};

const requiresApprovedGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.eligibility()?.decision === 'approved' ? true : router.parseUrl('/apply/eligibility');
};

const requiresDocumentsGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  const docs = state.docs();
  return docs.length > 0 && docs.every((d) => d.status === 'uploaded')
    ? true
    : router.parseUrl('/apply/documents');
};

const requiresSubmissionGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.submission().status !== 'idle' && state.submission().status !== 'submitting'
    ? true
    : router.parseUrl('/apply/contact');
};

const requiresOfferGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.offer() ? true : router.parseUrl('/apply/offers');
};

const requiresProfileGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.profile() ? true : router.parseUrl('/apply/profile');
};

const requiresBvnGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.bvn()?.verified ? true : router.parseUrl('/apply/bvn');
};

const requiresNinGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.nin()?.verified ? true : router.parseUrl('/apply/nin');
};

const requiresMandateGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.mandate()?.authorized ? true : router.parseUrl('/apply/mandate');
};

const requiresIdentityVerificationGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.identityVerification() ? true : router.parseUrl('/apply/verify-identity');
};

export const routes: Routes = [
  {
    path: '',
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
      { path: '', pathMatch: 'full', redirectTo: 'contact' },
      {
        path: 'contact',
        loadComponent: () =>
          import('./features/apply/contact/contact.component').then((m) => m.ContactComponent),
      },
      {
        path: 'verify',
        canMatch: [requiresContactGuard],
        loadComponent: () =>
          import('./features/apply/verify-phone/verify-phone.component').then(
            (m) => m.VerifyPhoneComponent,
          ),
      },
      {
        path: 'welcome-back',
        canMatch: [requiresContactGuard, requiresPhoneVerifiedGuard],
        loadComponent: () =>
          import('./features/apply/welcome-back/welcome-back.component').then(
            (m) => m.WelcomeBackComponent,
          ),
      },
      {
        path: 'employment',
        canMatch: [requiresContactGuard, requiresPhoneVerifiedGuard],
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
        path: 'bvn',
        canMatch: [requiresSalaryGuard],
        loadComponent: () =>
          import('./features/apply/bvn/bvn.component').then((m) => m.BvnComponent),
      },
      {
        path: 'nin',
        canMatch: [requiresBvnGuard],
        loadComponent: () =>
          import('./features/apply/nin/nin.component').then((m) => m.NinComponent),
      },
      {
        path: 'profile',
        canMatch: [requiresNinGuard],
        loadComponent: () =>
          import('./features/apply/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'eligibility',
        canMatch: [requiresNinGuard, requiresProfileGuard],
        loadComponent: () =>
          import('./features/apply/eligibility/eligibility.component').then(
            (m) => m.EligibilityComponent,
          ),
      },
      {
        path: 'offers',
        canMatch: [requiresProfileGuard, requiresApprovedGuard],
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
        path: 'mandate',
        canMatch: [requiresApprovedGuard, requiresOfferGuard],
        loadComponent: () =>
          import('./features/apply/mandate/mandate.component').then((m) => m.MandateComponent),
      },
      {
        path: 'documents',
        canMatch: [requiresMandateGuard],
        loadComponent: () =>
          import('./features/apply/documents/documents.component').then(
            (m) => m.DocumentsComponent,
          ),
      },
      {
        path: 'verify-identity',
        canMatch: [requiresMandateGuard, requiresDocumentsGuard],
        loadComponent: () =>
          import('./features/apply/verify-identity/verify-identity.component').then(
            (m) => m.VerifyIdentityComponent,
          ),
      },
      {
        path: 'submit',
        canMatch: [requiresMandateGuard, requiresDocumentsGuard, requiresIdentityVerificationGuard],
        loadComponent: () =>
          import('./features/apply/submit/submit.component').then((m) => m.SubmitComponent),
      },
      {
        path: 'status',
        canMatch: [requiresSubmissionGuard],
        loadComponent: () =>
          import('./features/apply/status/status.component').then((m) => m.StatusComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
