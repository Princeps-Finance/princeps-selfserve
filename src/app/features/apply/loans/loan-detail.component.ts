import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from '@princeps-finance/ui';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { formatNaira } from '../money';
import { ApiError, apiError } from '../data-access/api-error';
import { LoanDetail } from '../data-access/parity-contract';
import { ParityApi } from '../data-access/parity.api';

@Component({
  selector: 'app-loan-detail',
  imports: [ButtonDirective, SpinnerComponent, TPipe],
  template: `
    <section class="step">
      @if (loading()) {
        <app-spinner [label]="'loans.loading' | t" />
      } @else if (loan(); as loan) {
        <header class="head">
          <h1 class="title">{{ loan.productName }}</h1>
          <p class="subtitle">
            {{ 'loans.status.' + loan.status | t }} · {{ 'loans.ref' | t }} {{ loan.reference }}
          </p>
        </header>
        <div class="summary">
          <span>{{ 'loans.owed' | t }}</span
          ><strong class="money">{{ money(loan.balance) }}</strong
          ><span>{{
            'loans.repaid'
              | t
                : {
                    paid: money(loan.repayment.totalPaid),
                    total: money(loan.repayment.totalRepayable),
                  }
          }}</span>
        </div>
        <dl>
          @if (loan.repayment.nextDueDate) {
            <div>
              <dt>{{ 'loans.nextdue' | t }}</dt>
              <dd>
                {{ money(loan.repayment.monthlyAmount) }} ·
                {{ date(loan.repayment.nextDueDate) }}
              </dd>
            </div>
          }
          <div>
            <dt>{{ 'loans.borrowed' | t }}</dt>
            <dd>{{ money(loan.principal) }}</dd>
          </div>
          <div>
            <dt>{{ 'loans.monthly' | t }}</dt>
            <dd>{{ money(loan.monthlyRepayment) }}</dd>
          </div>
          <div>
            <dt>{{ 'loans.maturity' | t }}</dt>
            <dd>{{ date(loan.maturityDate) }}</dd>
          </div>
          <div>
            <dt>{{ 'loans.taken' | t }}</dt>
            <dd>{{ date(loan.disbursedAt) }}</dd>
          </div>
          <div>
            <dt>{{ 'loans.mandate' | t }}</dt>
            <dd>{{ 'loans.mandate.' + (mandateActive() ? 'on' : 'off') | t }}</dd>
          </div>
        </dl>
        <button appButton type="button" (click)="newLoan()">{{ 'loans.new' | t }}</button>
        <button appButton variant="secondary" type="button" (click)="back()">
          {{ 'loans.back' | t }}
        </button>
      } @else {
        <p class="error" role="alert">{{ error()?.message || ('loans.error' | t) }}</p>
        <button appButton variant="secondary" type="button" (click)="back()">
          {{ 'loans.back' | t }}
        </button>
      }
    </section>
  `,
  styleUrl: '../apply-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanDetailComponent {
  private readonly api = inject(ParityApi);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  readonly loan = signal<LoanDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);
  readonly money = formatNaira;
  readonly mandateActive = computed(() =>
    this.loan()?.mandates.some((mandate) => mandate.status === 'ACTIVE'),
  );
  constructor() {
    void this.load();
  }
  async load() {
    try {
      const loan = await this.api.getLoan(this.id);
      if (!this.destroy.destroyed) this.loan.set(loan);
    } catch (error) {
      if (!this.destroy.destroyed) this.error.set(apiError(error));
    } finally {
      if (!this.destroy.destroyed) this.loading.set(false);
    }
  }
  date(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  }
  back() {
    void this.router.navigateByUrl('/apply/loans');
  }
  newLoan() {
    void this.router.navigateByUrl('/apply/profile');
  }
}
