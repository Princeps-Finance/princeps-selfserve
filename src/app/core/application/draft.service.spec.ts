import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApplicationStateService } from './application-state.service';
import { DRAFT_TTL_MS, DraftService } from './draft.service';

const PHONE = '+2348031112233';
const KEY = 'princeps.draft';

describe('DraftService', () => {
  let state: ApplicationStateService;
  let drafts: DraftService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    state = TestBed.inject(ApplicationStateService);
    drafts = TestBed.inject(DraftService);
  });

  const verify = () => {
    state.setContact({ phone: PHONE, email: 'a@b.co' });
    state.markPhoneVerified();
  };
  const flush = () => TestBed.tick();

  it('saves nothing until the customer has verified their phone and entered something', () => {
    state.setContact({ phone: PHONE, email: 'a@b.co' });
    flush();
    expect(localStorage.getItem(KEY)).toBeNull();
    state.markPhoneVerified();
    flush();
    expect(localStorage.getItem(KEY)).toBeNull(); // verified but nothing to save yet
  });

  it('saves bio data and work details, and finds them again for the same phone only', () => {
    verify();
    state.setProfile({ fullName: 'Ada Obi' } as never);
    state.setEmployment({ type: 'government' });
    flush();
    const found = drafts.find(PHONE)!;
    expect(found.profile?.fullName).toBe('Ada Obi');
    expect(found.employment?.type).toBe('government');
    expect(drafts.find('+2348099999999')).toBeNull();
  });

  it('never saves BVN, NIN, photo, video, OTP or Caltos decisions', () => {
    verify();
    state.setProfile({ fullName: 'Ada Obi' } as never);
    state.setBvn({ value: '12345678901', verified: true });
    state.setNin({ value: '10987654321', verified: true });
    state.setIdentityVerification({ facePhotoDataUrl: 'data:face', videoDataUrl: 'data:video', capturedAt: 'x' });
    state.setEligibility({ score: 90, decision: 'approved', maxEligibleAmount: 300_000, tenorMonths: 12, reasons: [] });
    state.setOffer({ productId: 'ippis-advance' } as never);
    flush();
    const raw = localStorage.getItem(KEY)!;
    for (const secret of ['12345678901', '10987654321', 'data:face', 'data:video', 'ippis-advance', '300000']) {
      expect(raw).not.toContain(secret);
    }
  });

  it('forgets a draft after seven days', () => {
    verify();
    state.setProfile({ fullName: 'Ada Obi' } as never);
    flush();
    const d = JSON.parse(localStorage.getItem(KEY)!);
    d.savedAt = new Date(Date.now() - DRAFT_TTL_MS - 1000).toISOString();
    localStorage.setItem(KEY, JSON.stringify(d));
    expect(drafts.find(PHONE)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('is cleared on demand and ignores corrupt data', () => {
    verify();
    state.setProfile({ fullName: 'Ada Obi' } as never);
    flush();
    drafts.clear();
    expect(drafts.find(PHONE)).toBeNull();
    localStorage.setItem(KEY, '{not json');
    expect(drafts.find(PHONE)).toBeNull();
  });

  it('restores the saved answers into the application state', () => {
    verify();
    state.setProfile({ fullName: 'Ada Obi' } as never);
    state.setEmployment({ type: 'corper', nyscMonthsRemaining: 6 });
    flush();
    const saved = drafts.find(PHONE)!;
    state.reset();
    state.setContact({ phone: PHONE, email: 'a@b.co' });
    const route = drafts.restore(saved);
    expect(route).toContain('/apply/');
    expect(state.profile()?.fullName).toBe('Ada Obi');
    expect(state.employment()?.nyscMonthsRemaining).toBe(6);
  });
});
