import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { ApplicationStateService } from '../application/application-state.service';
import { LangService } from '../i18n/lang.service';
import { productById } from '../products/products';
import { APPLY } from './apply-routes';

/** Builds a route guard: the step opens when `isReady` is true, otherwise the customer is sent to `fallback`. */
function requires(isReady: (state: ApplicationStateService) => boolean, fallback: string): CanMatchFn {
  return () => (isReady(inject(ApplicationStateService)) ? true : inject(Router).parseUrl(fallback));
}

function needsNin(state: ApplicationStateService): boolean {
  return productById(state.offer()?.productId ?? '')?.settings.requiresNin ?? false;
}

export const languageChosenGuard: CanMatchFn = () =>
  inject(LangService).hasChosen() ? true : inject(Router).parseUrl(APPLY.home);

export const requiresBvnEnteredGuard = requires((s) => !!s.bvn(), APPLY.bvn);
export const requiresBvnGuard = requires((s) => !!s.bvn()?.verified, APPLY.bvn);
export const requiresContactGuard = requires((s) => !!s.contact(), APPLY.bvn);
export const requiresPhoneVerifiedGuard = requires((s) => s.phoneVerified(), APPLY.verify);
export const requiresProfileGuard = requires((s) => !!s.profile(), APPLY.profile);
export const requiresEmploymentGuard = requires((s) => !!s.employment(), APPLY.employment);
export const requiresSalaryGuard = requires((s) => !!s.salary(), APPLY.salary);
export const requiresApprovedGuard = requires(
  (s) => s.eligibility()?.decision === 'approved' || s.eligibility()?.decision === 'review',
  APPLY.eligibility,
);
export const requiresOfferGuard = requires((s) => !!s.offer(), APPLY.offers);
export const requiresTermsGuard = requires((s) => !!s.termsAcceptedAt(), APPLY.terms);

/** The ID check is only needed when the chosen product asks for it. */
export const requiresNinIfNeededGuard: CanMatchFn = (route, segments) => {
  const state = inject(ApplicationStateService);
  if (!state.bvn()?.verified) return inject(Router).parseUrl(APPLY.bvn);
  return requires((s) => !needsNin(s) || !!s.nin()?.verified, APPLY.nin)(route, segments);
};

export const requiresDocumentsGuard = requires(
  (s) => s.docs().length > 0 && s.docs().every((d) => d.status === 'uploaded'),
  APPLY.documents,
);
export const requiresIdentityVerificationGuard = requires((s) => !!s.identityVerification(), APPLY.verifyIdentity);
export const requiresMandateGuard = requires((s) => !!s.mandate()?.authorized, APPLY.mandate);
/** A received application is final: going back to the submit step must not create a second loan. */
export const requiresNotSubmittedGuard = requires((s) => s.submission().status !== 'received', APPLY.status);
/** The status screen only exists once the application has been received. */
export const requiresReceivedGuard = requires((s) => s.submission().status === 'received', APPLY.bvn);
