import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { ApplicationStateService } from '../application/application-state.service';
import { APPLY } from './apply-routes';
import { FlowNavigator } from './flow-navigator.service';
import {
  requiresBvnGuard,
  requiresCheckResultGuard,
  requiresIdentityOrCheckGuard,
  requiresOfferGuard,
  requiresReceivedGuard,
  requiresSalaryGuard,
} from './guards';

function run(guard: typeof requiresOfferGuard): unknown {
  return TestBed.runInInjectionContext(() => guard({} as never, []));
}

describe('flow guards', () => {
  let state: ApplicationStateService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    state = TestBed.inject(ApplicationStateService);
    router = TestBed.inject(Router);
  });

  it('sends the customer back to the missing step', () => {
    const result = run(requiresOfferGuard) as UrlTree;
    expect(router.serializeUrl(result)).toBe(APPLY.offers);
    expect(router.serializeUrl(run(requiresSalaryGuard) as UrlTree)).toBe(APPLY.salary);
    expect(router.serializeUrl(run(requiresBvnGuard) as UrlTree)).toBe(APPLY.bvn);
  });

  it('opens the work questions without identity only for the how-much-can-I-get check', () => {
    expect(router.serializeUrl(run(requiresIdentityOrCheckGuard) as UrlTree)).toBe(APPLY.welcome);
    state.setIntent('check');
    expect(run(requiresIdentityOrCheckGuard)).toBe(true);
  });

  it('shows the check result only after a check has produced one', () => {
    state.setIntent('check');
    expect(router.serializeUrl(run(requiresCheckResultGuard) as UrlTree)).toBe(APPLY.welcome);
    state.setEligibility({ score: 80, decision: 'approved', maxEligibleAmount: 300000, tenorMonths: 12, reasons: [] });
    expect(run(requiresCheckResultGuard)).toBe(true);
  });

  it('only opens the status screen once the application was received', () => {
    expect(run(requiresReceivedGuard)).toBeInstanceOf(UrlTree);
    state.setSubmission({ status: 'received', referenceId: 'PR-1' });
    expect(run(requiresReceivedGuard)).toBe(true);
  });
});

describe('FlowNavigator', () => {
  it('goes to the ID check only when the product needs it', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const nav = TestBed.inject(FlowNavigator);
    const seen: string[] = [];
    nav.go = (url: string) => (seen.push(url), Promise.resolve(true));
    await nav.afterTerms(true);
    await nav.afterTerms(false);
    expect(seen).toEqual([APPLY.nin, APPLY.documents]);
  });
});
