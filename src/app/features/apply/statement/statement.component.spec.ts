import { TestBed } from '@angular/core/testing';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { StatementComponent } from './statement.component';

describe('StatementComponent in the no-identity check', () => {
  it('reviews the statement with no BVN or code and goes to the result', async () => {
    const go = vi.fn().mockResolvedValue(true);
    const checkStatement = vi.fn().mockResolvedValue({ status: 'ok', decision: 'approved', maxAmount: 250000, tenorMonths: 6, monthlyIncome: 200000 });
    TestBed.configureTestingModule({
      providers: [
        { provide: API_CLIENT, useValue: { listBanks: vi.fn().mockResolvedValue([]), checkStatement, submitStatementReview: vi.fn() } },
        { provide: FlowNavigator, useValue: { go } },
      ],
    });
    const state = TestBed.inject(ApplicationStateService);
    state.setIntent('check');
    state.setEmployment({ type: 'private-sector' });
    const c = TestBed.createComponent(StatementComponent).componentInstance;
    c.form.patchValue({ employer: 'Acme Ltd', bankCode: '058' });
    c.file.set(new File(['x'], 'statement.pdf', { type: 'application/pdf' }));
    await c.submit();
    expect(checkStatement).toHaveBeenCalledWith(expect.objectContaining({ employer: 'Acme Ltd', bankCode: '058', fileName: 'statement.pdf' }));
    expect(state.eligibility()).toMatchObject({ decision: 'approved', maxEligibleAmount: 250000 });
    expect(go).toHaveBeenCalledWith(APPLY.checkResult);
  });

  it('opens the limit window when the check is rate limited', async () => {
    const go = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: API_CLIENT, useValue: { listBanks: vi.fn().mockResolvedValue([]), checkStatement: vi.fn().mockResolvedValue({ status: 'rate-limited' }) } },
        { provide: FlowNavigator, useValue: { go } },
      ],
    });
    const state = TestBed.inject(ApplicationStateService);
    state.setIntent('check');
    state.setEmployment({ type: 'private-sector' });
    const c = TestBed.createComponent(StatementComponent).componentInstance;
    c.form.patchValue({ employer: 'Acme Ltd', bankCode: '058' });
    c.file.set(new File(['x'], 'statement.pdf', { type: 'application/pdf' }));
    await c.submit();
    expect(c.limited()).toBe(true);
    expect(go).not.toHaveBeenCalled();
  });
});
