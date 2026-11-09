import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { EligibilityComponent } from './eligibility.component';

describe('EligibilityComponent decline', () => {
  afterEach(() => vi.useRealTimers());

  it('shows translated reasons and next steps instead of a dead end', async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const state = TestBed.inject(ApplicationStateService);
    state.setEmployment({ type: 'corper', nyscMonthsRemaining: 2 });
    state.setSalary({ channel: 'remita', monthlyIncome: 180_000 } as never);

    const fixture = TestBed.createComponent(EligibilityComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(1000);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(state.eligibility()?.decision).toBe('declined');
    expect(el.textContent).toContain('NYSC service ends in 2 month(s)');
    expect(el.textContent).not.toContain('Declined:'); // no raw scorer text
    const actions = Array.from(el.querySelectorAll('.next-action')).map((a) => a.getAttribute('href') ?? a.textContent!.trim());
    expect(actions.length).toBe(3);
    expect(actions.some((a) => a.startsWith('https://wa.me/'))).toBe(true);
    expect(actions.some((a) => a.startsWith('tel:'))).toBe(true);
  });
});
