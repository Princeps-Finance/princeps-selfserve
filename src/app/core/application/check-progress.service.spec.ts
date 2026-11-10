import { TestBed } from '@angular/core/testing';
import { ApplicationStateService } from './application-state.service';
import { CheckProgressService } from './check-progress.service';

describe('CheckProgressService', () => {
  afterEach(() => sessionStorage.clear());

  it('keeps the check across a reload, without the account number', async () => {
    let state = TestBed.inject(ApplicationStateService);
    TestBed.inject(CheckProgressService);
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'federal' });
    state.setSalary({ channel: 'ippis', bankCode: '058', bankName: 'GTBank', accountNumber: '0123456789', ippisNumber: '445566', monthlyIncome: 250000, fromCheck: true });
    state.setEligibility({ score: 80, decision: 'approved', maxEligibleAmount: 300000, tenorMonths: 12, reasons: [] });
    TestBed.flushEffects();
    const stored = sessionStorage.getItem('princeps.check-progress') ?? '';
    expect(stored).not.toContain('0123456789');
    expect(stored).not.toContain('445566');

    // A reload: a fresh app with the same tab storage.
    TestBed.resetTestingModule();
    state = TestBed.inject(ApplicationStateService);
    TestBed.inject(CheckProgressService);
    expect(state.intent()).toBe('check');
    expect(state.employment()).toMatchObject({ type: 'government', governmentLevel: 'federal' });
    expect(state.salary()).toMatchObject({ bankName: 'GTBank', accountNumber: '', monthlyIncome: 250000 });
    expect(state.eligibility()).toMatchObject({ decision: 'approved', maxEligibleAmount: 300000 });
  });

  it('stores nothing for the normal application', () => {
    const state = TestBed.inject(ApplicationStateService);
    TestBed.inject(CheckProgressService);
    state.setEmployment({ type: 'government', governmentLevel: 'federal' });
    TestBed.flushEffects();
    expect(sessionStorage.getItem('princeps.check-progress')).toBeNull();
  });
});
