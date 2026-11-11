import { AnimatedIconComponent } from '../../../shared/animated-icon.component';
import { IconComponent } from '../../../shared/icon.component';
import { dueDateOf, firstPaydayAfter } from '../../../core/products/payday';
import { CardComponent } from '../../../shared/card.component';
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

@Component({
  selector: 'app-terms',
  imports: [AnimatedIconComponent, IconComponent, CardComponent, TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.css',
})
export class TermsComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  readonly offer = this.state.offer;
  readonly formatNaira = formatNaira;
  /** The schedule can be long, so it starts folded; the first payday above it stays in view. */
  readonly scheduleOpen = signal(false);

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
      dueDate: dueDateOf(firstDue, line.month),
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

  /** Interest over the whole loan. */
  readonly totalInterest = computed(() => Math.max(0, this.totalRepayable() - (this.offer()?.amount ?? 0)));
  readonly totalFees = computed(() =>
    (this.offer()?.fees ?? []).reduce((acc, f) => acc + f.amount, 0),
  );

  back(): void {
    void this.flow.go(APPLY.offers);
  }

  /** On to the documents. The offer letter comes after them, right before the repayment set-up. */
  take(): void {
    const needsNin = productById(this.offer()?.productId ?? '')?.settings.requiresNin ?? false;
    void this.flow.afterTerms(needsNin);
  }
}
