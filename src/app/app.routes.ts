import { inject } from '@angular/core';
import { CanMatchFn, Router, Routes } from '@angular/router';
import { LangService } from './core/i18n/lang.service';
import { ApplicationStateService } from './core/application/application-state.service';
import { productById } from './core/products/products';

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
  const decision = state.eligibility()?.decision;
  return decision === 'approved' || decision === 'review' ? true : router.parseUrl('/apply/eligibility');
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

const requiresTermsGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  return state.termsAcceptedAt() ? true : router.parseUrl('/apply/terms');
};

/** NIN is only needed when the chosen product asks for it. */
const requiresNinIfNeededGuard: CanMatchFn = () => {
  const state = inject(ApplicationStateService);
  const router = inject(Router);
  const product = productById(state.offer()?.productId ?? '');
  const needsNin = product?.settings.requiresNin ?? false;
  if (!state.bvn()?.verified) return router.parseUrl('/apply/bvn');
  return !needsNin || state.nin()?.verified ? true : router.parseUrl('/apply/nin');
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
  const product = productById(state.offer()?.productId ?? '');
  if (product?.settings.identityVideo === 'none' && state.docs().length > 0) return true;
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
      { path: '', pathMatch: 'full', redirectTo: 'welcome' },
      {
        path: 'welcome',
        loadComponent: () =>
          import('./features/apply/welcome/welcome.component').then((m) => m.WelcomeIntentComponent),
      },
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
        path: 'welcome-back',
        canMatch: [requiresContactGuard, requiresPhoneVerifiedGuard],
        loadComponent: () =>
          import('./features/apply/welcome-back/welcome-back.component').then(
            (m) => m.WelcomeBackComponent,
          ),
      },
      {
        path: 'employment',
        canMatch: [requiresContactGuard, requiresPhoneVerifiedGuard, requiresProfileGuard],
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
        canMatch: [requiresContactGuard, requiresPhoneVerifiedGuard, requiresEmploymentGuard],
        loadComponent: () =>
          import('./features/apply/statement/statement.component').then((m) => m.StatementComponent),
      },
      {
        path: 'bvn',
        canMatch: [requiresContactGuard],
        loadComponent: () =>
          import('./features/apply/bvn/bvn.component').then((m) => m.BvnComponent),
      },
      {
        path: 'nin',
        canMatch: [requiresTermsGuard, requiresBvnGuard],
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
        canMatch: [requiresSalaryGuard],
        loadComponent: () =>
          import('./features/apply/eligibility/eligibility.component').then(
            (m) => m.EligibilityComponent,
          ),
      },
      {
        path: 'offers',
        canMatch: [requiresSalaryGuard, requiresApprovedGuard],
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
        canMatch: [requiresDocumentsGuard, requiresIdentityVerificationGuard],
        loadComponent: () =>
          import('./features/apply/mandate/mandate.component').then((m) => m.MandateComponent),
      },
      {
        path: 'documents',
        canMatch: [requiresTermsGuard, requiresNinIfNeededGuard],
        loadComponent: () =>
          import('./features/apply/documents/documents.component').then(
            (m) => m.DocumentsComponent,
          ),
      },
      {
        path: 'verify-identity',
        canMatch: [requiresNinIfNeededGuard, requiresDocumentsGuard],
        loadComponent: () =>
          import('./features/apply/verify-identity/verify-identity.component').then(
            (m) => m.VerifyIdentityComponent,
          ),
      },
      {
        path: 'submit',
        canMatch: [requiresMandateGuard],
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
