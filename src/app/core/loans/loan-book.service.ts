import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { API_CLIENT, LoanSummary } from '../api/api-client';
import { ApplicationStateService } from '../application/application-state.service';
import { APPLY } from '../flow/apply-routes';
import { FlowNavigator } from '../flow/flow-navigator.service';
import { logWarn } from '../log';

export type LoanBookStatus = 'idle' | 'loading' | 'ready' | 'error';

/** The signed-in customer's existing loans, loaded once from Caltos and shared by the list and detail screens. */
@Injectable({ providedIn: 'root' })
export class LoanBookService {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  constructor() {
    // Loans belong to the verified phone: once that is cleared ("not me", start over) they must not linger.
    effect(() => {
      if (!this.state.phoneVerified()) this.clear();
    });
  }

  readonly loans = signal<LoanSummary[]>([]);
  readonly status = signal<LoanBookStatus>('idle');

  /** Loans still being repaid, overdue ones first so they are not missed. */
  readonly open = computed(() =>
    this.loans()
      .filter((l) => l.status !== 'completed')
      .sort((a, b) => Number(b.status === 'overdue') - Number(a.status === 'overdue')),
  );
  readonly completed = computed(() => this.loans().filter((l) => l.status === 'completed'));

  async load(force = false): Promise<void> {
    if (this.status() === 'loading' || (!force && this.status() === 'ready')) return;
    this.status.set('loading');
    try {
      this.loans.set(await this.api.listLoans());
      this.status.set('ready');
    } catch (err) {
      logWarn('loans unavailable', err);
      this.status.set('error');
    }
  }

  byId(id: string | null): LoanSummary | undefined {
    return this.loans().find((l) => l.id === id);
  }

  /**
   * A returning customer borrows again. The employment type is remembered; identity and bank details are
   * collected and verified again, so nothing is carried over unverified.
   */
  startNewLoan(): Promise<boolean> {
    const snapshot = this.state.returningSnapshot();
    if (snapshot) this.state.setEmployment({ type: snapshot.employmentType });
    return this.flow.go(APPLY.profile);
  }

  /** Forget everything when the customer leaves, so the next person on a shared device sees nothing. */
  clear(): void {
    this.loans.set([]);
    this.status.set('idle');
  }
}
