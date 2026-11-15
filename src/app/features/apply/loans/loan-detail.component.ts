import { AnimatedIconComponent } from '../../../shared/animated-icon.component';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { LoanBookService } from '../../../core/loans/loan-book.service';
import { formatNaira } from '../../../core/money.util';
import { LoanStatusBadgeComponent } from './loan-status-badge.component';

/** One existing loan in full, with the way to take a new one. */
@Component({
  selector: 'app-loan-detail',
  imports: [AnimatedIconComponent, TPipe, LoanStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loan-detail.component.html',
  styleUrl: './loans.component.css',
})
export class LoanDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly flow = inject(FlowNavigator);
  protected readonly book = inject(LoanBookService);

  private readonly id = signal(this.route.snapshot.paramMap.get('id'));
  protected readonly loan = computed(() => this.book.byId(this.id()));
  protected readonly formatNaira = formatNaira;
  protected readonly progress = computed(() => {
    const l = this.loan();
    return l ? (l.instalmentsPaid / Math.max(l.instalmentsTotal, 1)) * 100 : 0;
  });

  async ngOnInit(): Promise<void> {
    await this.book.load();
    // A loan that is not in the list (a stale link) has nothing to show: go back to the list.
    if (this.book.status() === 'ready' && !this.loan()) await this.flow.go(APPLY.loans);
  }

  protected back(): void {
    void this.flow.go(APPLY.loans);
  }

  protected newLoan(): void {
    void this.book.startNewLoan();
  }

  protected date(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
}
