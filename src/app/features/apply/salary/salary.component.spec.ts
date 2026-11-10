import { TestBed } from '@angular/core/testing';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { SalaryComponent } from './salary.component';

function setup() {
  const go = vi.fn().mockResolvedValue(true);
  const api = { listBanks: vi.fn().mockResolvedValue([]), verifySalary: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: API_CLIENT, useValue: api },
      { provide: FlowNavigator, useValue: { go } },
    ],
  });
  return { go, api, state: TestBed.inject(ApplicationStateService) };
}

describe('SalaryComponent in the no-identity check', () => {
  it('asks only for pay, saves it as the customer\'s own figure, and goes to eligibility without calling the back end', async () => {
    const { go, api, state } = setup();
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'state' });
    const c = TestBed.createComponent(SalaryComponent).componentInstance;
    expect(c.askPay).toBe(true);
    expect(c.askAccount).toBe(false);
    expect(c.canSubmit()).toBe(false);

    c.form.controls.monthlyIncome.setValue('250,000');
    expect(c.canSubmit()).toBe(true);
    await c.submit();

    expect(api.verifySalary).not.toHaveBeenCalled();
    expect(state.salary()).toMatchObject({ channel: 'remita', monthlyIncome: 250000, declared: true, bankCode: '' });
    expect(go).toHaveBeenCalledWith(APPLY.eligibility);
  });

  it('defaults federal government to IPPIS', () => {
    const { state } = setup();
    state.setIntent('check');
    state.setEmployment({ type: 'government', governmentLevel: 'federal' });
    expect(TestBed.createComponent(SalaryComponent).componentInstance.channel()).toBe('ippis');
  });

  it('after identity, with pay already given, asks only for the salary account', () => {
    const { state } = setup();
    state.setEmployment({ type: 'government', governmentLevel: 'federal' });
    state.setSalary({ channel: 'ippis', bankCode: '', bankName: '', accountNumber: '', monthlyIncome: 250000, declared: true });
    const c = TestBed.createComponent(SalaryComponent).componentInstance;
    expect(c.mode).toBe('verify');
    expect(c.askPay).toBe(false);
    expect(c.askAccount).toBe(true);
  });
});
