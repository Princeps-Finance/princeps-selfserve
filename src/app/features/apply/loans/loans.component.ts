import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { loanRoute } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { LoanBookService } from '../../../core/loans/loan-book.service';
import { formatNaira } from '../../../core/money.util';
import { LoanStatusBadgeComponent } from './loan-status-badge.component';

/** Where a returning customer lands after verifying: their loans, and a way to take a new one. */
@Component({
  selector: 'app-loans',
  imports: [ButtonDirective, TPipe, LoanStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loans.component.html',
  styleUrl: './loans.component.css',
})
export class LoansComponent implements OnInit {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  protected readonly book = inject(LoanBookService);

  protected readonly formatNaira = formatNaira;
  protected readonly hasLoans = computed(() => this.book.open().length + this.book.completed().length > 0);

  /** Only a first name is shown; nothing else from the record is displayed here. */
  protected readonly firstName = computed(() => {
    const raw = this.state.bvnIdentity()?.firstName ?? this.state.returningSnapshot()?.fullName.split(/\s+/)[0] ?? '';
    return raw.trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
  });

  ngOnInit(): void {
    void this.book.load();
  }

  protected open(id: string): void {
    void this.flow.go(loanRoute(id));
  }

  protected newLoan(): void {
    void this.book.startNewLoan();
  }

  protected retry(): void {
    void this.book.load(true);
  }

  protected due(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
}
