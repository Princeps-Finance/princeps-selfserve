import { TestBed } from '@angular/core/testing';
import { API_CLIENT } from '../api/api-client';
import { ApplicationStateService } from '../application/application-state.service';
import { ReferralLinkService } from './referral-link.service';

const found = { code: 'WELCOME', rateDiscountPct: 0.75, label: '0.75% rate discount' };

function setup(check: (code: string) => Promise<typeof found | null>) {
  TestBed.configureTestingModule({ providers: [{ provide: API_CLIENT, useValue: { checkReferral: check } }] });
  return { link: TestBed.inject(ReferralLinkService), state: TestBed.inject(ApplicationStateService) };
}

describe('ReferralLinkService', () => {
  afterEach(() => {
    sessionStorage.clear();
    history.replaceState(null, '', '/');
  });

  it('applies a valid code that came in with the link, once', async () => {
    history.replaceState(null, '', '/?ref=welcome-not-valid-shape!');
    sessionStorage.setItem('princeps.referral-link', 'WELCOME');
    const check = vi.fn().mockResolvedValue(found);
    const { link, state } = setup(check);
    await link.applyPending();
    expect(state.referral()?.code).toBe('WELCOME');
    await link.applyPending();
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('ignores a code in the wrong shape and one the server does not know', async () => {
    history.replaceState(null, '', '/?ref=../../x');
    const check = vi.fn().mockResolvedValue(null);
    const a = setup(check);
    await a.link.applyPending();
    expect(check).not.toHaveBeenCalled();
    expect(a.state.referral()).toBeNull();
  });

  it('keeps a code the customer already applied', async () => {
    sessionStorage.setItem('princeps.referral-link', 'WELCOME');
    const check = vi.fn().mockResolvedValue(found);
    const { link, state } = setup(check);
    state.setReferral({ code: 'NAIRA5', rateDiscountPct: 0.5, label: 'x' });
    await link.applyPending();
    expect(state.referral()?.code).toBe('NAIRA5');
  });
});
