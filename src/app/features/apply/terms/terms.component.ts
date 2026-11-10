import { estimateApr } from '../../../../shared/pricing';
import { dueDateOf, firstPaydayAfter } from '../../../core/products/payday';
import { CardComponent } from '../../../shared/card.component';
import { CheckboxComponent } from '../../../shared/checkbox.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { productById } from '../../../core/products/products';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { formatNaira } from '../../../core/money.util';
import { APPLY } from '../../../core/flow/apply-routes';
import { OfferLetterComponent } from './offer-letter.component';
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
  imports: [CardComponent, CheckboxComponent, TPipe, WizardProgressComponent, OfferLetterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.css',
})
export class TermsComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  readonly offer = this.state.offer;
  readonly agreed = signal(false);
  /** Set when the offer letter has been scrolled to the end. The agreement box stays locked until then. */
  readonly letterRead = signal(false);
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

  /** What the offer letter is generated for. */
  readonly letterRequest = computed(() => {
    const o = this.offer();
    return {
      productId: o?.productId ?? '',
      productName: o?.productName ?? '',
      amount: o?.amount ?? 0,
      tenorMonths: o?.tenorMonths ?? 0,
      monthlyRepayment: o?.monthlyRepayment ?? 0,
      ratePercent: o?.ratePercent ?? 0,
    };
  });

  /** Interest over the whole loan, and the yearly rate it works out to once fees are counted. */
  readonly totalInterest = computed(() => Math.max(0, this.totalRepayable() - (this.offer()?.amount ?? 0)));
  readonly apr = computed(() => {
    const o = this.offer();
    return o ? Math.round(estimateApr(o.amount, this.totalFees(), o.monthlyRepayment, o.tenorMonths)) : 0;
  });

  readonly totalFees = computed(() =>
    (this.offer()?.fees ?? []).reduce((acc, f) => acc + f.amount, 0),
  );

  toggleAgree(v: boolean): void {
    if (v && !this.letterRead()) return;
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
