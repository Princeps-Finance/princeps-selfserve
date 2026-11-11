import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { ApplicationStateService } from '../application/application-state.service';
import { LangService } from '../i18n/lang.service';
import { ReturningService } from '../application/returning.service';
import { productById } from '../products/products';
import { JOURNEY_ROUTE, JourneyKey, JourneyService } from './journey';
import { APPLY } from './apply-routes';

/** Builds a route guard: the step opens when `isReady` is true, otherwise the customer is sent to `fallback`. */
function requires(isReady: (state: ApplicationStateService) => boolean, fallback: string): CanMatchFn {
  return () => {
    if (isReady(inject(ApplicationStateService))) return true;
    // After a reload or a re-opened app the answers in memory are gone. A device that already knows the customer
    // offers "Continue as ..." on the welcome screen instead of asking for the BVN from scratch.
    const known = fallback === APPLY.bvn && !!inject(ReturningService).saved();
    return inject(Router).parseUrl(known ? APPLY.welcome : fallback);
  };
}

function needsNin(state: ApplicationStateService): boolean {
  return productById(state.offer()?.productId ?? '')?.settings.requiresNin ?? false;
}

/** The language screen is for first visits only: once a language is chosen on this device, the app opens straight in. */
export const languageNotChosenGuard: CanMatchFn = () =>
  inject(LangService).hasChosen() ? inject(Router).parseUrl(APPLY.root) : true;

export const languageChosenGuard: CanMatchFn = () =>
  inject(LangService).hasChosen() ? true : inject(Router).parseUrl(APPLY.home);

export const requiresBvnEnteredGuard = requires((s) => !!s.bvn() || !!s.returningRef(), APPLY.bvn);
export const requiresBvnGuard = requires((s) => !!s.bvn()?.verified, APPLY.bvn);
export const requiresContactGuard = requires((s) => !!s.contact(), APPLY.bvn);
export const requiresPhoneVerifiedGuard = requires((s) => s.phoneVerified(), APPLY.verify);
export const requiresProfileGuard = requires((s) => !!s.profile(), APPLY.profile);
/** The work questions open for the no-identity "how much can I get" check, or after identity is verified. */
export const requiresIdentityOrCheckGuard = requires(
  (s) => s.intent() === 'check' || (!!s.contact() && s.phoneVerified() && !!s.profile()),
  APPLY.welcome,
);
export const requiresCheckResultGuard = requires((s) => s.intent() === 'check' && !!s.eligibility(), APPLY.welcome);
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
export const requiresReceivedGuard = requires((s) => s.restoreReceipt(), APPLY.welcome);

/** A step after the offer opens only when every step before it, in this product's order, is done. */
export const journeyGuard = (key: JourneyKey): CanMatchFn => () => {
  const blocked = inject(JourneyService).blockedAt(key);
  return blocked && blocked !== JOURNEY_ROUTE[key] ? inject(Router).parseUrl(blocked) : true;
};
