import { AnimatedIconComponent } from '../../../shared/animated-icon.component';
import { ResultTimerComponent } from '../../../core/eligibility/result-timer.component';
import { IconComponent } from '../../../shared/icon.component';
import { dayToDate } from '../../../../shared/quote';
import { QuoteService } from '../../../core/pricing/quote.service';
import { CardComponent } from '../../../shared/card.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { formatNaira } from '../../../core/money.util';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

interface ScheduleRow {
  month: number;
  dueDate: Date;
  payment: number;
  balance: number;
}

@Component({
  selector: 'app-terms',
  imports: [AnimatedIconComponent, IconComponent, ResultTimerComponent, CardComponent, TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.css',
})
export class TermsComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly quotes = inject(QuoteService);
  readonly checking = signal(false);

  readonly offer = this.state.offer;
  readonly formatNaira = formatNaira;
  /** The schedule can be long, so it starts folded; the first payday above it stays in view. */
  readonly scheduleOpen = signal(false);

  modelKey(m: string): string {
    if (m === 'Flat Rate') return 'step.offers.model.flat';
    if (m === 'Reducing Balance') return 'step.offers.model.reducing';
    return 'step.offers.model.percent';
  }

  /** The server's schedule, dates and all. Nothing here is worked out on the phone. */
  readonly schedule = computed<ScheduleRow[]>(() =>
    (this.offer()?.quote?.schedule ?? []).map((l) => ({ month: l.month, dueDate: dayToDate(l.dueDate), payment: l.payment, balance: l.balance })),
  );

  readonly firstDueDate = computed(() => this.schedule()[0]?.dueDate ?? null);
  readonly lastDueDate = computed(() => this.schedule().at(-1)?.dueDate ?? null);

  formatDueDate(d: Date | null): string {
    if (!d) return '';
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  readonly totalRepayable = computed(() => this.offer()?.quote?.totalRepayable ?? 0);
  readonly totalInterest = computed(() => this.offer()?.quote?.totalInterest ?? 0);
  readonly totalFees = computed(() => this.offer()?.quote?.totalFees ?? 0);

  constructor() {
    // An offer with no server quote cannot be accepted: send the customer back to get one.
    if (this.state.offer() && !this.state.offer()?.quote) void this.flow.go(APPLY.offers);
  }

  back(): void {
    void this.flow.go(APPLY.offers);
  }

  /** On to the documents, once the quote is confirmed as still valid. The offer letter comes after them. */
  async take(): Promise<void> {
    if (this.checking()) return;
    this.checking.set(true);
    try {
      if (await this.quotes.confirm()) await this.flow.afterTerms();
    } finally {
      this.checking.set(false);
    }
  }
}
