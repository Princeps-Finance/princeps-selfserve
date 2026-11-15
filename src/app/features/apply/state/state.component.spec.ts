import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { StateEmployersService } from '../../../core/api/state-employers.service';
import type { StateGovernment } from '../../../core/api/state-employers';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { StateComponent } from './state.component';

const many = (n: number): StateGovernment[] =>
  Array.from({ length: n }, (_, i) => ({ code: `s${i}`, name: `State ${i}`, channel: 'remita' as const, employers: [] }));

function setup(states: StateGovernment[]) {
  const go = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({
    providers: [
      { provide: StateEmployersService, useValue: { states: signal(states), load: vi.fn().mockResolvedValue(undefined) } },
      { provide: FlowNavigator, useValue: { go } },
    ],
  });
  TestBed.inject(ApplicationStateService).setEmployment({ type: 'government', governmentLevel: 'state' });
  const fixture = TestBed.createComponent(StateComponent);
  fixture.detectChanges();
  return { fixture, go, state: TestBed.inject(ApplicationStateService) };
}

describe('StateComponent', () => {
  it('shows a short list as cards', () => {
    const { fixture } = setup(many(7));
    expect(fixture.nativeElement.querySelectorAll('button.option').length).toBe(7);
    expect(fixture.nativeElement.querySelector('app-select-field')).toBeNull();
  });

  it('switches to a searchable picker for a long list, such as all 36 states', () => {
    const { fixture } = setup(many(36));
    expect(fixture.nativeElement.querySelectorAll('button.option').length).toBe(0);
    expect(fixture.nativeElement.querySelector('app-select-field')).not.toBeNull();
    expect(fixture.componentInstance.stateOptions().length).toBe(36);
  });

  it('keeps the chosen state and goes on to the salary details', async () => {
    const { fixture, go, state } = setup(many(36));
    fixture.componentInstance.pickCode('s5');
    await Promise.resolve();
    expect(state.employment()?.state).toMatchObject({ code: 's5', name: 'State 5', channel: 'remita' });
    expect(go).toHaveBeenCalledWith(APPLY.salary);
  });

  it('asks for the employer when the state has several', () => {
    const list = many(3);
    list[1] = { ...list[1], employers: [{ code: 'e1', name: 'Employer 1', channel: 'dedukt' }] };
    const { fixture, go } = setup(list);
    fixture.componentInstance.pickState(list[1]);
    fixture.detectChanges();
    expect(go).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Employer 1');
  });
});
