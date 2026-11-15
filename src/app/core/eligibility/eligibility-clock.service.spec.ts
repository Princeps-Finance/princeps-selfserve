import { TestBed } from '@angular/core/testing';
import { ApplicationStateService } from '../application/application-state.service';
import { ELIGIBILITY_TTL_MS } from '../limits';
import { EligibilityClock } from './eligibility-clock.service';

describe('EligibilityClock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const state = TestBed.inject(ApplicationStateService);
    const clock = TestBed.inject(EligibilityClock);
    state.setEmployment({ type: 'government' });
    state.setSalary({} as never);
    state.setEligibility({ score: 80, decision: 'approved', maxEligibleAmount: 100_000, tenorMonths: 6, reasons: [] });
    state.setOffer({ productId: 'ippis-advance' } as never);
    TestBed.tick();
    return { state, clock };
  }

  it('counts down from an hour and warns in the last five minutes', () => {
    const { clock } = setup();
    expect(clock.label()).toBe('60:00');
    expect(clock.low()).toBe(false);
    vi.advanceTimersByTime(ELIGIBILITY_TTL_MS - 4 * 60 * 1000);
    TestBed.tick();
    expect(clock.low()).toBe(true);
  });

  it('clears the result and what followed it after an hour, keeping the work and salary details', () => {
    const { state, clock } = setup();
    vi.advanceTimersByTime(ELIGIBILITY_TTL_MS + 1000);
    TestBed.tick();
    expect(clock.expired()).toBe(true);
    expect(state.eligibility()).toBeNull();
    expect(state.offer()).toBeNull();
    expect(state.employment()).not.toBeNull();
    expect(state.salary()).not.toBeNull();
  });

  it('never clears a result once the application was sent', () => {
    const { state } = setup();
    state.setSubmission({ status: 'received', referenceId: 'R' });
    vi.advanceTimersByTime(ELIGIBILITY_TTL_MS + 1000);
    TestBed.tick();
    expect(state.eligibility()).not.toBeNull();
  });
});
