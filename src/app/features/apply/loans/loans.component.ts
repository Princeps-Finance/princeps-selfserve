import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective } from '@princeps-finance/ui';
import { AnimatedIconComponent } from '../../../shared/components/animated-icon.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { formatNaira } from '../money';
import { ApiError, apiError } from '../data-access/api-error';
import { LoanListItem, LoansResponse } from '../data-access/parity-contract';
import { ParityApi } from '../data-access/parity.api';

@Component({
  selector: 'app-loans',
  imports: [ButtonDirective, AnimatedIconComponent, SpinnerComponent, TPipe],
  template: `
    <section class="step">
      <header class="head">
        <h1 class="title">
          {{ 'loans.title' | t }}
        </h1>
        <p class="subtitle">{{ 'loans.sub' | t }}</p>
      </header>
      @if (loading()) {
        <app-spinner [label]="'loans.loading' | t" />
      } @else if (error()) {
        <div class="state" role="alert">
          <p>{{ 'loans.error' | t }}</p>
          <button appButton variant="secondary" type="button" (click)="load()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else {
        @if (!data()?.loans?.length) {
          <p class="state">{{ 'loans.none' | t }}</p>
        }
        @if (openLoans().length) {
          <section class="group" aria-labelledby="open-loans-title">
            <h2 id="open-loans-title">{{ 'loans.open' | t }}</h2>
            <ul class="list">
              @for (loan of openLoans(); track loan.id) {
                <li>
                  <button class="loan" type="button" (click)="open(loan.id)">
                    <span class="loan-top"
                      ><strong>{{ loan.productName }}</strong
                      ><span class="status" [attr.data-status]="loan.status">{{
                        'loans.status.' + loan.status | t
                      }}</span></span
                    >
                    <span class="owed"
                      ><small>{{ 'loans.owed' | t }}</small
                      ><strong>{{ money(loan.balance) }}</strong></span
                    >
                    <span class="next">{{ date(loan.maturityDate) }}</span>
                    <span class="bar"><span [style.width.%]="progress(loan)"></span></span>
                  </button>
                </li>
              }
            </ul>
          </section>
        }
        @if (pastLoans().length) {
          <section class="group" aria-labelledby="past-loans-title">
            <h2 id="past-loans-title">{{ 'loans.past' | t }}</h2>
            <ul class="list">
              @for (loan of pastLoans(); track loan.id) {
                <li>
                  <button class="loan loan--past" type="button" (click)="open(loan.id)">
                    <span class="loan-top"
                      ><strong>{{ loan.productName }}</strong
                      ><span class="status" data-status="closed">{{
                        'loans.status.closed' | t
                      }}</span></span
                    >
                    <span class="next">{{ money(loan.principal) }}</span>
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      }
      <button appButton class="cta" type="button" (click)="newLoan()">
        {{ 'loans.new' | t }}
        <app-animated-icon animation="arrow-right" fallback="outline-arrow-right" [size]="18" />
      </button>
      <p class="hint">{{ 'loans.new.hint' | t }}</p>
    </section>
  `,
  styleUrl: '../apply-step.css',
  styles: [
    `
      .head,
      .state {
        display: grid;
        gap: var(--space-3);
      }
      .group {
        display: grid;
        gap: var(--space-3);
      }
      .group h2 {
        margin: 0;
        font-size: var(--fs-lg);
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-3);
      }
      .loan {
        width: 100%;
        padding: var(--space-5);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-lg);
        background: var(--surface-0);
        color: var(--ink);
        text-align: start;
        display: grid;
        gap: var(--space-3);
        cursor: pointer;
        font: inherit;
      }
      .loan-top,
      .owed {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3);
      }
      .owed strong {
        font: 600 var(--fs-xl) var(--font-display);
      }
      .next,
      small {
        color: var(--ink-soft);
      }
      .status {
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--info-soft);
        font-size: var(--fs-xs);
      }
      .status[data-status='closed'] {
        background: var(--success-soft);
      }
      .bar {
        height: 5px;
        overflow: hidden;
        border-radius: 999px;
        background: var(--hairline-strong);
      }
      .bar span {
        display: block;
        height: 100%;
        background: var(--action-primary);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoansComponent {
  private readonly api = inject(ParityApi);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly data = signal<LoansResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly openLoans = computed(
    () => this.data()?.loans.filter((loan) => loan.status === 'open') ?? [],
  );
  readonly pastLoans = computed(
    () => this.data()?.loans.filter((loan) => loan.status === 'closed') ?? [],
  );
  readonly money = formatNaira;
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.api.listLoans();
      if (!this.destroy.destroyed) this.data.set(data);
    } catch (error) {
      if (!this.destroy.destroyed) this.error.set(apiError(error));
    } finally {
      if (!this.destroy.destroyed) this.loading.set(false);
    }
  }
  progress(loan: LoanListItem) {
    return loan.principal
      ? Math.min(100, ((loan.principal - loan.balance) / loan.principal) * 100)
      : 0;
  }
  date(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  }
  open(id: string) {
    void this.router.navigate(['/apply/loans', id]);
  }
  newLoan() {
    void this.router.navigateByUrl('/apply/profile');
  }
}
