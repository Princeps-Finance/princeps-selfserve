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
    localStorage.clear();
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
    'verify', 'resume', 'loans', 'loans/:id', 'profile', 'employment', 'waitlist', 'salary', 'eligibility',
    'offers', 'saved', 'terms', 'nin', 'documents', 'verify-identity', 'mandate', 'submit', 'status',
  ];

  const verified = () => {
    state.setContact({ phone: '+2348031112233', email: 'a@b.co' });
    state.markPhoneVerified();
  };
  const approve = (decision: 'approved' | 'review' | 'declined' = 'approved') =>
    state.setEligibility({ score: 80, decision, maxEligibleAmount: 100_000, tenorMonths: 6, reasons: [] });

  it('opens welcome and the BVN screen to anyone, and blocks everything else on a fresh session', () => {
    expect(allows('welcome')).toBe(true);
    expect(allows('bvn')).toBe(true);
    for (const path of PROTECTED) expect(allows(path), path).toBe(false);
  });

  it('collects bio data first, then work details, then checks eligibility', () => {
    state.setBvn({ value: '12345678901', verified: false });
    expect(allows('verify')).toBe(true);
    expect(allows('profile')).toBe(false);

    state.setContact({ phone: '+2348031112233', email: '' });
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

  it('asks for the documentation details only after an offer is chosen', () => {
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
    expect(allows('documents')).toBe(true); // the review comes first, then the documents
  });

  it('asks for the BVN first, then the code, and only then the rest of the application', () => {
    expect(allows('bvn')).toBe(true); // nothing needed before it
    expect(allows('verify')).toBe(false); // needs a BVN to send the code to
    state.setBvn({ value: '12345678901', verified: false });
    expect(allows('verify')).toBe(true);
    expect(allows('profile')).toBe(false); // needs the BVN owner to confirm with the code
    state.setContact({ phone: '+2348012345678', email: '' });
    state.markPhoneVerified();
    expect(allows('profile')).toBe(true);
  });

  it('lets a manual-review result continue (not a dead end) but never a decline', () => {
    verified();
    state.setEmployment({ type: 'government' });
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
    approve();
    state.setBvn({ value: '12345678901', verified: true });
    state.setOffer({ productId: 'ippis-advance' } as never); // NIN not required
    expect(allows('documents')).toBe(true);
    state.setOffer({ productId: 'corper-allowee' } as never); // NIN required
    expect(allows('documents')).toBe(false);
    state.setNin({ value: '12345678901', verified: true });
    expect(allows('documents')).toBe(true);
  });

  it('runs documents, then identity capture, then the offer letter, then the mandate, and submit last', () => {
    state.setBvn({ value: '12345678901', verified: true });
    state.setOffer({ productId: 'ippis-advance' } as never);
    state.setDocs([{ id: 'a', name: 'A', status: 'uploaded' }, { id: 'b', name: 'B', status: 'pending' }]);
    expect(allows('verify-identity')).toBe(false); // needs the documents
    state.setDocs([{ id: 'a', name: 'A', status: 'uploaded' }, { id: 'b', name: 'B', status: 'uploaded' }]);
    expect(allows('verify-identity')).toBe(true);
    expect(allows('offer-letter')).toBe(false); // needs the identity capture
    state.setIdentityVerification({ facePhotoDataUrl: 'x', videoDataUrl: 'y', capturedAt: 'z' });
    expect(allows('offer-letter')).toBe(true);
    expect(allows('mandate')).toBe(false); // needs the offer letter accepted
    state.setTermsAccepted(new Date().toISOString());
    expect(allows('mandate')).toBe(true);
    expect(allows('submit')).toBe(false); // needs the mandate
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
