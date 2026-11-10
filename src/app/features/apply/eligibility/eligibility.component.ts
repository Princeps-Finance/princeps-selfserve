import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { telLink, whatsappLink } from '../../../core/support';
import {
  scoreEligibility,
  EligibilityInput,
  MdaCategory,
  ReasonCode,
} from '../../../core/eligibility/eligibility-scoring';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

const REVIEW_BAND_MIN = 45;
const REVIEW_BAND_MAX = 55;

@Component({
  selector: 'app-eligibility',
  imports: [TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './eligibility.component.html',
  styleUrl: './eligibility.component.css',
})
export class EligibilityComponent implements OnInit {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  readonly phase = signal<'checking' | 'declined'>('checking');
  readonly reasonCodes = signal<ReasonCode[]>([]);
  readonly whatsapp = whatsappLink('Hello Princeps, I was told I am not eligible right now and I would like help.');
  readonly tel = telLink();

  async ngOnInit(): Promise<void> {
    const employment = this.state.employment();
    const salary = this.state.salary();
    // The route guard guarantees both; the check only narrows the types.
    if (!employment || !salary) return;

    // Small deliberate delay so the spinner reads as work being done.
    await new Promise((r) => setTimeout(r, 700));

    const stability: EligibilityInput['stability'] =
      employment.type === 'corper'
        ? { type: 'nysc-corper', monthsRemaining: employment.nyscMonthsRemaining ?? 0 }
        : { type: 'mda', category: this.toMdaCategory(employment.type) };

    const input: EligibilityInput = {
      income: { source: this.incomeSource(), monthlyAmount: salary.monthlyIncome },
      stability,
      repaymentHistory: { isRepeatBorrower: this.state.isReturningCustomer() },
      exposure: { hasActiveLoanElsewhere: false },
    };

    const result = scoreEligibility(input);

    // Overlay a manual-review band (new tier per FLOW-SPEC — not in the scorer itself).
    let decision: 'approved' | 'declined' | 'review' = result.decision;
    if (
      result.decision === 'approved' &&
      result.score >= REVIEW_BAND_MIN &&
      result.score < REVIEW_BAND_MAX
    ) {
      decision = 'review';
    }

    this.state.setEligibility({
      score: result.score,
      decision,
      maxEligibleAmount: result.maxEligibleAmount,
      tenorMonths: result.tenorMonths,
      reasons: result.reasons,
      reasonCodes: result.reasonCodes,
    });

    // A 'review' result is not a dead end: the customer still chooses an offer and submits,
    // and a person reviews the application afterwards.
    if (decision === 'approved' || decision === 'review') {
      await this.flow.go(APPLY.offers);
      return;
    }
    this.reasonCodes.set(result.reasonCodes);
    this.phase.set('declined');
  }

  private toMdaCategory(t: string): MdaCategory {
    return t === 'paramilitary' ? 'paramilitary' : 'federal';
  }

  private incomeSource(): EligibilityInput['income']['source'] {
    const c = this.state.salary()?.channel;
    if (c === 'remita') return 'remita';
    if (c === 'dedukt') return 'deduct';
    return 'wacs';
  }

  editDetails(): void {
    void this.flow.go(APPLY.employment);
  }

  home(): void {
    void this.flow.go(APPLY.home);
  }
}
