import { TestBed } from '@angular/core/testing';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { SalaryComponent } from './salary.component';

function setup(check = vi.fn()) {
  const go = vi.fn().mockResolvedValue(true);
  const api = { listBanks: vi.fn().mockResolvedValue([]), resolveAccount: vi.fn().mockResolvedValue({ status: 'ok', accountName: 'A ADEYEMI' }), verifySalary: vi.fn(), checkEligibility: check };
  TestBed.configureTestingModule({
    providers: [
      { provide: API_CLIENT, useValue: api },
      { provide: FlowNavigator, useValue: { go } },
    ],
  });
  return { go, api, state: TestBed.inject(ApplicationStateService) };
}

async function fill(c: SalaryComponent): Promise<void> {
  c.form.patchValue({ bankCode: '058', bankName: 'GTBank', accountNumber: '0123456789', ippisNumber: '445566' });
  await new Promise((r) => setTimeout(r));
}

describe('SalaryComponent in the no-identity check', () => {
  it('runs the real check from the account details, keeps the account, and shows the result without asking for pay', async () => {
    const { go, api, state } = setup(vi.fn().mockResolvedValue({ status: 'ok', decision: 'approved', maxAmount: 347500, tenorMonths: 12, monthlyIncome: 250000 }));
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'federal' });
    const c = TestBed.createComponent(SalaryComponent).componentInstance;
    expect(c.showChannelChoice()).toBe(false);
    await fill(c);
    await c.submit();

    expect(api.verifySalary).not.toHaveBeenCalled();
    expect(api.checkEligibility).toHaveBeenCalledWith(expect.objectContaining({ employmentType: 'government', governmentLevel: 'federal', channel: 'ippis', accountNumber: '0123456789' }));
    expect(state.salary()).toMatchObject({ accountNumber: '0123456789', fromCheck: true, monthlyIncome: 250000 });
    expect(state.eligibility()).toMatchObject({ decision: 'approved', maxEligibleAmount: 347500, tenorMonths: 12 });
    expect(go).toHaveBeenCalledWith(APPLY.checkResult);
  });

  it('shows an error and stays put when the account is not found', async () => {
    const { go, state } = setup(vi.fn().mockResolvedValue({ status: 'not-found' }));
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'state' });
    const c = TestBed.createComponent(SalaryComponent).componentInstance;
    expect(c.channel()).toBe('remita');
    await fill(c);
    await c.submit();
    expect(c.errorKey()).toBe('step.salary.error.not.found');
    expect(go).not.toHaveBeenCalled();
  });

  it('opens a window, and goes nowhere, when the limit on checks is reached', async () => {
    const { go, state } = setup(vi.fn().mockResolvedValue({ status: 'rate-limited' }));
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'federal' });
    const c = TestBed.createComponent(SalaryComponent).componentInstance;
    await fill(c);
    await c.submit();
    expect(c.limited()).toBe(true);
    expect(go).not.toHaveBeenCalled();
  });

  it('after identity, checks the saved account again by itself and does not ask for it', async () => {
    const { go, api, state } = setup();
    api.verifySalary.mockResolvedValue({ status: 'ok', monthlyIncome: 200000, accountName: 'Ada Obi' });
    state.setEmployment({ type: 'government', governmentLevel: 'federal' });
    state.setProfile({ fullName: 'Ada Obi', dateOfBirth: '1990-01-01', address: { street: 'x', state: 'Lagos', lga: 'Ikeja' }, relationshipStatus: 'single' } as never);
    state.setSalary({ channel: 'ippis', bankCode: '058', bankName: 'GTBank', accountNumber: '0123456789', ippisNumber: '445566', monthlyIncome: 0, fromCheck: true });
    const c = TestBed.createComponent(SalaryComponent).componentInstance;
    expect(c.mode).toBe('verify');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(api.verifySalary).toHaveBeenCalled();
    expect(state.salary()).toMatchObject({ monthlyIncome: 200000 });
    expect(state.salary()?.fromCheck).toBeFalsy();
    expect(go).toHaveBeenCalledWith(APPLY.eligibility);
  });
});
