import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, UrlTree, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ApplicationStateService } from './core/application/application-state.service';

const applyRoute = routes.find((r) => r.path === 'apply') as Route;
const child = (path: string) => applyRoute.children!.find((r) => r.path === path) as Route;

describe('wizard route guards', () => {
  let state: ApplicationStateService;
  let injector: EnvironmentInjector;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    state = TestBed.inject(ApplicationStateService);
    injector = TestBed.inject(EnvironmentInjector);
  });

  /** True only if every guard on the route lets the navigation through. */
  function allows(path: string): boolean {
    const guards = (child(path).canMatch ?? []) as CanMatchFn[];
    return guards.every((g) => {
      const result = runInInjectionContext(injector, () => g(child(path), []));
      return !(result instanceof UrlTree) && result === true;
    });
  }

  const PROTECTED = [
    'verify', 'welcome-back', 'employment', 'waitlist', 'salary', 'bvn', 'nin', 'profile',
    'eligibility', 'offers', 'terms', 'mandate', 'documents', 'verify-identity', 'submit', 'status',
  ];

  it('blocks every step beyond contact on a fresh session', () => {
    for (const path of PROTECTED) expect(allows(path), path).toBe(false);
  });

  it('opens steps one at a time as their prerequisites are met', () => {
    state.setContact({ phone: '+2348031112233', email: 'a@b.co' });
    expect(allows('verify')).toBe(true);
    expect(allows('employment')).toBe(false);
    expect(allows('waitlist')).toBe(false);

    state.markPhoneVerified();
    expect(allows('employment')).toBe(true);
    expect(allows('waitlist')).toBe(true);
    expect(allows('salary')).toBe(false);

    state.setEmployment({ type: 'government' });
    expect(allows('salary')).toBe(true);
    expect(allows('bvn')).toBe(false);
  });

  it('does not let a declined applicant reach offers, terms or mandate', () => {
    state.setContact({ phone: '+2348031112233', email: 'a@b.co' });
    state.markPhoneVerified();
    state.setProfile({} as never);
    state.setEligibility({ score: 10, decision: 'declined', maxEligibleAmount: 0, tenorMonths: 0, reasons: [] });
    state.setOffer({} as never);
    expect(allows('offers')).toBe(false);
    expect(allows('terms')).toBe(false);
    expect(allows('mandate')).toBe(false);

    state.setEligibility({ score: 90, decision: 'approved', maxEligibleAmount: 100_000, tenorMonths: 6, reasons: [] });
    expect(allows('offers')).toBe(true);
    expect(allows('terms')).toBe(true);
  });

  it('requires all documents before identity capture and submit', () => {
    state.setMandate({ authorized: true } as never);
    state.setDocs([{ id: 'a', name: 'A', status: 'uploaded' }, { id: 'b', name: 'B', status: 'pending' }]);
    expect(allows('verify-identity')).toBe(false);
    state.setDocs([{ id: 'a', name: 'A', status: 'uploaded' }, { id: 'b', name: 'B', status: 'uploaded' }]);
    expect(allows('verify-identity')).toBe(true);
    expect(allows('submit')).toBe(false);
    state.setIdentityVerification({ facePhotoDataUrl: 'x', videoDataUrl: 'y', capturedAt: 'z' });
    expect(allows('submit')).toBe(true);
  });

  it('only shows the status page after a submission outcome exists', () => {
    expect(allows('status')).toBe(false);
    state.setSubmission({ status: 'submitting' });
    expect(allows('status')).toBe(false);
    state.setSubmission({ status: 'review', referenceId: 'R' });
    expect(allows('status')).toBe(true);
  });
});
