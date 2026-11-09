import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { formatNaira } from '../../../core/money.util';

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
export class TermsComponent implements OnInit {
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);

  readonly offer = this.state.offer;
  readonly agreed = signal(false);
  readonly attempted = signal(false);
  readonly formatNaira = formatNaira;

  readonly schedule = computed<ScheduleRow[]>(() => {
    const o = this.offer();
    if (!o) return [];
    return buildSchedule(o.amount, o.tenorMonths, o.ratePercent, o.interestModel);
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

  async ngOnInit(): Promise<void> {
    if (!this.offer()) await this.router.navigateByUrl('/apply/offers');
  }

  toggleAgree(v: boolean): void {
    this.agreed.set(v);
    if (v) this.attempted.set(false);
  }

  back(): void {
    void this.router.navigateByUrl('/apply/offers');
  }

  take(): void {
    if (!this.agreed()) {
      this.attempted.set(true);
      document.querySelector<HTMLElement>('.agree input')?.focus();
      return;
    }
    this.state.setTermsAccepted(new Date().toISOString());
    void this.router.navigateByUrl('/apply/bvn');
  }
}

function buildSchedule(
  principal: number,
  n: number,
  ratePercent: number,
  model: 'Flat Rate' | 'Reducing Balance' | 'Percentage Based',
): ScheduleRow[] {
  const r = ratePercent / 100;
  const rows: ScheduleRow[] = [];
  const firstDue = firstPaydayAfter(new Date());
  const dueFor = (m: number) =>
    new Date(firstDue.getFullYear(), firstDue.getMonth() + (m - 1), PAYDAY_DAY);
  if (model === 'Reducing Balance') {
    const pmt = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    let balance = principal;
    for (let m = 1; m <= n; m++) {
      const interest = balance * r;
      const principalPaid = pmt - interest;
      balance -= principalPaid;
      rows.push({
        month: m,
        dueDate: dueFor(m),
        principal: Math.round(principalPaid),
        interest: Math.round(interest),
        payment: Math.round(pmt),
        balance: Math.max(0, Math.round(balance)),
      });
    }
  } else if (model === 'Percentage Based') {
    const principalPerMonth = principal / n;
    let balance = principal;
    for (let m = 1; m <= n; m++) {
      const interest = principal * r;
      balance -= principalPerMonth;
      rows.push({
        month: m,
        dueDate: dueFor(m),
        principal: Math.round(principalPerMonth),
        interest: Math.round(interest),
        payment: Math.round(principalPerMonth + interest),
        balance: Math.max(0, Math.round(balance)),
      });
    }
  } else {
    // Flat Rate
    const total = principal * (1 + r);
    const pmt = total / n;
    const principalPerMonth = principal / n;
    const interestPerMonth = (principal * r) / n;
    let balance = principal;
    for (let m = 1; m <= n; m++) {
      balance -= principalPerMonth;
      rows.push({
        month: m,
        dueDate: dueFor(m),
        principal: Math.round(principalPerMonth),
        interest: Math.round(interestPerMonth),
        payment: Math.round(pmt),
        balance: Math.max(0, Math.round(balance)),
      });
    }
  }
  return rows;
}
