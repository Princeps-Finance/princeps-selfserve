import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, UrlTree, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ApplicationStateService } from './core/application/application-state.service';

const applyRoute = routes.find((r) => r.path === 'apply') as Route;
const child = (path: string) => applyRoute.children!.find((r) => r.path === path) as Route;

describe('wizard route guards (bio data → work → offer → loan documentation)', () => {
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
    'verify', 'resume', 'welcome-back', 'profile', 'employment', 'waitlist', 'salary', 'eligibility',
    'offers', 'saved', 'terms', 'bvn', 'nin', 'documents', 'verify-identity', 'mandate', 'submit', 'status',
  ];

  const verified = () => {
    state.setContact({ phone: '+2348031112233', email: 'a@b.co' });
    state.markPhoneVerified();
  };
  const approve = (decision: 'approved' | 'review' | 'declined' = 'approved') =>
    state.setEligibility({ score: 80, decision, maxEligibleAmount: 100_000, tenorMonths: 6, reasons: [] });

  it('opens welcome and contact to anyone, and blocks everything else on a fresh session', () => {
    expect(allows('welcome')).toBe(true);
    for (const path of PROTECTED) expect(allows(path), path).toBe(false);
  });

  it('collects bio data first, then work details, then checks eligibility', () => {
    state.setContact({ phone: '+2348031112233', email: 'a@b.co' });
    expect(allows('verify')).toBe(true);
    expect(allows('profile')).toBe(false);

    state.markPhoneVerified();
    expect(allows('profile')).toBe(true);
    expect(allows('employment')).toBe(false); // needs bio data first
    expect(allows('waitlist')).toBe(true);

    state.setProfile({} as never);
    expect(allows('employment')).toBe(true);
    expect(allows('salary')).toBe(false);

    state.setEmployment({ type: 'government' });
    expect(allows('salary')).toBe(true);
    expect(allows('eligibility')).toBe(false);

    state.setSalary({} as never);
    expect(allows('eligibility')).toBe(true);
  });

  it('asks for the documentation details only after an offer is chosen and the terms accepted', () => {
    verified();
    state.setBvn({ value: '12345678901', verified: true }); // BVN is confirmed first, at sign-in
    state.setProfile({} as never);
    state.setEmployment({ type: 'government' });
    state.setSalary({} as never);
    approve();
    expect(allows('offers')).toBe(true);
    expect(allows('documents')).toBe(false);
    state.setOffer({ productId: 'ippis-advance' } as never);
    expect(allows('terms')).toBe(true);
    expect(allows('documents')).toBe(false);
    state.setTermsAccepted(new Date().toISOString());
    expect(allows('documents')).toBe(true);
  });

  it('asks for the BVN straight after the phone number, before anything else', () => {
    state.setContact({ phone: '+2348012345678', email: 'a@b.ng' });
    expect(allows('bvn')).toBe(true);
    expect(allows('profile')).toBe(false); // needs the BVN owner to confirm first
  });

  it('lets a manual-review result continue (not a dead end) but never a decline', () => {
    verified();
    state.setSalary({} as never);
    approve('declined');
    state.setOffer({ productId: 'ippis-advance' } as never);
    expect(allows('offers')).toBe(false);
    expect(allows('terms')).toBe(false);
    approve('review');
    expect(allows('offers')).toBe(true);
    expect(allows('terms')).toBe(true);
  });

  it('only asks for NIN when the chosen product needs it', () => {
    state.setBvn({ value: '12345678901', verified: true });
    state.setTermsAccepted(new Date().toISOString());
    state.setOffer({ productId: 'ippis-advance' } as never); // NIN not required
    expect(allows('documents')).toBe(true);
    state.setOffer({ productId: 'corper-allowee' } as never); // NIN required
    expect(allows('documents')).toBe(false);
    state.setNin({ value: '12345678901', verified: true });
    expect(allows('documents')).toBe(true);
  });

  it('puts identity capture after documents, the mandate after identity, and submit last', () => {
    state.setBvn({ value: '12345678901', verified: true });
    state.setOffer({ productId: 'ippis-advance' } as never);
    state.setDocs([{ id: 'a', name: 'A', status: 'uploaded' }, { id: 'b', name: 'B', status: 'pending' }]);
    expect(allows('verify-identity')).toBe(false);
    state.setDocs([{ id: 'a', name: 'A', status: 'uploaded' }, { id: 'b', name: 'B', status: 'uploaded' }]);
    expect(allows('verify-identity')).toBe(true);
    expect(allows('mandate')).toBe(false);
    state.setIdentityVerification({ facePhotoDataUrl: 'x', videoDataUrl: 'y', capturedAt: 'z' });
    expect(allows('mandate')).toBe(true);
    expect(allows('submit')).toBe(false);
    state.setMandate({ authorized: true } as never);
    expect(allows('submit')).toBe(true);
  });

  it('only shows the status page after the application was received', () => {
    expect(allows('status')).toBe(false);
    state.setSubmission({ status: 'submitting' });
    expect(allows('status')).toBe(false);
    state.setSubmission({ status: 'received', referenceId: 'R' });
    expect(allows('status')).toBe(true);
  });
});
