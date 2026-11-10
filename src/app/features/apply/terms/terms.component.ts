import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { productById } from '../../../core/products/products';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { formatNaira } from '../../../core/money.util';
import { APPLY } from '../../../core/flow/apply-routes';
import { buildRepaymentSchedule } from '../../../../shared/pricing';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

interface ScheduleRow {
  month: number;
  dueDate: Date;
  principal: number;
  interest: number;
  payment: number;
  balance: number;
}

const PAYDAY_DAY = 25;

function firstPaydayAfter(from: Date): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  const d = from.getDate();
  // If disbursed on or before the 15th of the month, first repayment is this month's 25th.
  // Otherwise, roll to next month's 25th so the borrower doesn't owe within 10 days.
  const monthOffset = d <= 15 ? 0 : 1;
  return new Date(y, m + monthOffset, PAYDAY_DAY);
}

@Component({
  selector: 'app-terms',
  imports: [TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.css',
})
export class TermsComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  readonly offer = this.state.offer;
  readonly agreed = signal(false);
  readonly attempted = signal(false);
  readonly formatNaira = formatNaira;

  modelKey(m: string): string {
    if (m === 'Flat Rate') return 'step.offers.model.flat';
    if (m === 'Reducing Balance') return 'step.offers.model.reducing';
    return 'step.offers.model.percent';
  }

  readonly schedule = computed<ScheduleRow[]>(() => {
    const o = this.offer();
    if (!o) return [];
    const firstDue = firstPaydayAfter(new Date());
    return buildRepaymentSchedule(o.amount, o.tenorMonths, o.ratePercent, o.interestModel).map((line) => ({
      ...line,
      dueDate: new Date(firstDue.getFullYear(), firstDue.getMonth() + (line.month - 1), PAYDAY_DAY),
    }));
  });

  readonly firstDueDate = computed(() => this.schedule()[0]?.dueDate ?? null);
  readonly lastDueDate = computed(() => this.schedule().at(-1)?.dueDate ?? null);

  formatDueDate(d: Date | null): string {
    if (!d) return '';
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  readonly totalRepayable = computed(() =>
    this.schedule().reduce((acc, r) => acc + r.payment, 0),
  );

  readonly totalFees = computed(() =>
    (this.offer()?.fees ?? []).reduce((acc, f) => acc + f.amount, 0),
  );

  toggleAgree(v: boolean): void {
    this.agreed.set(v);
    if (v) this.attempted.set(false);
  }

  back(): void {
    void this.flow.go(APPLY.offers);
  }

  take(): void {
    if (!this.agreed()) {
      this.attempted.set(true);
      document.querySelector<HTMLElement>('.agree input')?.focus();
      return;
    }
    this.state.setTermsAccepted(new Date().toISOString());
    const needsNin = productById(this.offer()?.productId ?? '')?.settings.requiresNin ?? false;
    void this.flow.afterTerms(needsNin);
  }
}
