import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IllustrationComponent } from '../../../core/ui/illustration.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { formatNaira } from '../../../core/money.util';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

@Component({
  selector: 'app-welcome-back',
  imports: [TPipe, IllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './welcome-back.component.html',
  styleUrl: './welcome-back.component.css',
})
export class WelcomeBackComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  readonly snapshot = this.state.returningSnapshot;
  readonly formatNaira = formatNaira;

  /** Only a first name is shown; employer, account, income and the rest stay out of sight. */
  readonly firstName = computed(() => {
    const raw = this.state.bvnIdentity()?.firstName ?? this.snapshot()?.fullName.split(/\s+/)[0] ?? '';
    return raw.trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
  });

  readonly lastLoanLabel = computed(() => {
    const s = this.snapshot();
    if (!s) return '';
    return new Date(s.lastLoanAt).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  });

  constructor() {
    if (!this.state.phoneVerified() || !this.state.isReturningCustomer() || !this.snapshot()) {
      void this.flow.go(APPLY.profile);
    }
  }

  /**
   * Returning customers keep their employment type, but identity and bank
   * details are always collected and verified again. The snapshot only holds
   * the last 4 digits of the account, and BVN/NIN are never pre-filled, so
   * nothing is invented or carried over unverified.
   */
  borrowAgain(): void {
    const s = this.snapshot();
    if (!s) return;
    // Bio data and work details are shown again (nothing is carried over unverified), but the
    // employment type is remembered so the customer does not have to pick it twice.
    this.state.setEmployment({ type: s.employmentType });
    void this.flow.go(APPLY.profile);
  }

  updateDetails(): void {
    void this.flow.go(APPLY.profile);
  }
}
