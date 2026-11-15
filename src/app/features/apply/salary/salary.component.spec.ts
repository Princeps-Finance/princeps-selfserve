import { TestBed } from '@angular/core/testing';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { SalaryComponent } from './salary.component';

function setup(check = vi.fn(), requirements = vi.fn().mockResolvedValue({ payslip: false })) {
  const go = vi.fn().mockResolvedValue(true);
  const api = { listBanks: vi.fn().mockResolvedValue([]), resolveAccount: vi.fn().mockResolvedValue({ status: 'ok', accountName: 'A ADEYEMI' }), verifySalary: vi.fn(), checkEligibility: check, getSalaryRequirements: requirements };
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
    // Federal staff can pick IPPIS or Remita; IPPIS is picked to start.
    expect(c.showChannelChoice()).toBe(true);
    expect(c.channel()).toBe('ippis');
    await fill(c);
    await c.submit();

    expect(api.verifySalary).not.toHaveBeenCalled();
    expect(api.checkEligibility).toHaveBeenCalledWith(expect.objectContaining({ employmentType: 'government', governmentLevel: 'federal', channel: 'ippis', accountNumber: '0123456789' }));
    expect(state.salary()).toMatchObject({ accountNumber: '0123456789', fromCheck: true, monthlyIncome: 250000 });
    expect(state.eligibility()).toMatchObject({ decision: 'approved', maxEligibleAmount: 347500, tenorMonths: 12 });
    expect(go).toHaveBeenCalledWith(APPLY.checkResult);
  });

  it('sends Remita when a federal worker picks it', async () => {
    const { api, state } = setup(vi.fn().mockResolvedValue({ status: 'ok', decision: 'approved', maxAmount: 347500, tenorMonths: 12, monthlyIncome: 250000 }));
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'federal' });
    const c = TestBed.createComponent(SalaryComponent).componentInstance;
    c.setChannel('remita');
    await fill(c);
    await c.submit();
    expect(api.checkEligibility).toHaveBeenCalledWith(expect.objectContaining({ governmentLevel: 'federal', channel: 'remita' }));
  });

  it('does not ask state government staff: their state decides', () => {
    const { state } = setup(vi.fn());
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'state', state: { code: 'ondo', name: 'Ondo', channel: 'remita' } });
    const c = TestBed.createComponent(SalaryComponent).componentInstance;
    expect(c.showChannelChoice()).toBe(false);
    expect(c.channel()).toBe('remita');
  });

  it('clears the account number when the customer picks a different bank, but not when a saved answer is put back', async () => {
    const { state } = setup(vi.fn());
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'federal' });
    const c = TestBed.createComponent(SalaryComponent).componentInstance;
    await fill(c);
    // A programmatic change (a saved answer) leaves the number alone.
    c.form.controls.bankCode.setValue('044');
    expect(c.form.controls.accountNumber.value).toBe('0123456789');
    // The customer choosing another bank clears it.
    c.form.controls.bankCode.markAsDirty();
    c.form.controls.bankCode.setValue('057');
    expect(c.form.controls.accountNumber.value).toBe('');
  });

  it('offers the payslip upload only when the back end asks for it, never just because the channel is Remita', async () => {
    const requirements = vi.fn().mockImplementation(async (i: { channel: string }) => ({ payslip: i.channel === 'ippis' }));
    const { state } = setup(vi.fn(), requirements);
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'federal' });
    const c = TestBed.createComponent(SalaryComponent).componentInstance;
    await new Promise((r) => setTimeout(r));
    expect(c.asksForPayslip()).toBe(true);
    expect(requirements).toHaveBeenCalledWith(expect.objectContaining({ employmentType: 'government', governmentLevel: 'federal', channel: 'ippis' }));
    c.setChannel('remita');
    await new Promise((r) => setTimeout(r));
    expect(c.asksForPayslip()).toBe(false);
  });

  it('sends the state and employer so the back end can decide per employer', async () => {
    const requirements = vi.fn().mockResolvedValue({ payslip: true });
    const { state } = setup(vi.fn(), requirements);
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'state', state: { code: 'adamawa', name: 'Adamawa', employer: { code: 'adamawa-phcda', name: 'Adamawa PHCDA' }, channel: 'dedukt' } });
    TestBed.createComponent(SalaryComponent);
    await new Promise((r) => setTimeout(r));
    expect(requirements).toHaveBeenCalledWith({ employmentType: 'government', channel: 'dedukt', governmentLevel: 'state', stateCode: 'adamawa', employerCode: 'adamawa-phcda' });
  });

  it('does not ask for a payslip when the back end cannot be reached', async () => {
    const { state } = setup(vi.fn(), vi.fn().mockRejectedValue(new Error('down')));
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'federal' });
    const c = TestBed.createComponent(SalaryComponent).componentInstance;
    await new Promise((r) => setTimeout(r));
    expect(c.asksForPayslip()).toBe(false);
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
