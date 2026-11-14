import { InputDirective } from '../../../shared/components/input/input.directive';
import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { TPipe } from '../../../core/i18n/t.pipe';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { DEFAULT_ELIGIBILITY_CONFIG } from '../../../core/eligibility/eligibility-scoring';
import { telLink, whatsappLink } from '../../../core/support';
import { WizardProgressComponent } from '../wizard-progress.component';
import {
  ApplicationStateService,
  EmploymentType,
} from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

interface Option {
  type: EmploymentType;
  labelKey: string;
  hintKey: string;
  live: boolean;
}

const OPTIONS: Option[] = [
  { type: 'government', labelKey: 'step.employment.government', hintKey: 'step.employment.government.hint', live: true },
  { type: 'paramilitary', labelKey: 'step.employment.paramilitary', hintKey: 'step.employment.paramilitary.hint', live: true },
  { type: 'corper', labelKey: 'step.employment.corper', hintKey: 'step.employment.corper.hint', live: true },
  { type: 'private-sector', labelKey: 'step.employment.private', hintKey: 'step.employment.private.hint', live: true },
  { type: 'own-business', labelKey: 'step.employment.business', hintKey: 'step.employment.business.hint', live: false },
];

@Component({
  selector: 'app-employment',
  imports: [InputDirective, ButtonDirective, TPipe, WizardProgressComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employment.component.html',
  styleUrl: './employment.component.css',
})
export class EmploymentComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  /** Only segments we can serve now are options. The rest are a single waitlist link, not disabled-looking rows. */
  readonly options = OPTIONS;
  readonly selected = signal<EmploymentType | null>(this.state.employment()?.type ?? null);
  readonly submitting = signal(false);
  readonly attempted = signal(false);

  readonly nyscMonths = new FormControl<number | null>(
    this.state.employment()?.nyscMonthsRemaining ?? null,
    { validators: [Validators.required, Validators.min(1), Validators.max(11)] },
  );

  /** Corpers below this many months left cannot be offered a loan: tell them now, not after four more steps. */
  readonly minCorperMonths = DEFAULT_ELIGIBILITY_CONFIG.stability.nysc.minEligibleMonthsRemaining;
  readonly months = signal<number | null>(this.nyscMonths.value);
  readonly tooShort = computed(() => {
    const m = this.months();
    return this.selected() === 'corper' && m !== null && m >= 1 && m < this.minCorperMonths;
  });
  readonly whatsapp = whatsappLink('Hello Princeps, my NYSC service is almost over and I would like help.');
  readonly tel = telLink();

  readonly showCorperMonths = computed(() => this.selected() === 'corper');
  readonly selectedOption = computed(() =>
    OPTIONS.find((o) => o.type === this.selected()) ?? null,
  );
  readonly canContinue = computed(() => {
    const opt = this.selectedOption();
    if (!opt) return false;
    if (!opt.live) return true;
    if (opt.type === 'corper') return this.nyscMonths.valid && !this.tooShort();
    return true;
  });

  onMonthsInput(): void {
    this.months.set(this.nyscMonths.value);
  }

  /** One tap moves on. Only a corper needs one more answer (months left), so only they get a button. */
  select(type: EmploymentType): void {
    this.selected.set(type);
    this.attempted.set(false);
    if (type !== 'corper') void this.continue();
  }

  async continue(): Promise<void> {
    if (this.submitting()) return;
    if (!this.canContinue()) {
      this.attempted.set(true);
      if (this.selectedOption()) {
        this.nyscMonths.markAsTouched();
        if (this.tooShort()) document.getElementById('months')?.focus();
        else focusFirstInvalid();
      } else {
        document.querySelector<HTMLElement>('[role="radio"]')?.focus();
      }
      return;
    }
    const opt = this.selectedOption();
    if (!opt) return;

    if (!opt.live) {
      await this.flow.go(APPLY.waitlist, { queryParams: { type: opt.type } });
      return;
    }
    if (opt.type === 'private-sector') {
      this.state.setEmployment({ type: opt.type });
      await this.flow.go(APPLY.statement);
      return;
    }

    this.submitting.set(true);
    try {
      this.state.setEmployment({
        type: opt.type,
        nyscMonthsRemaining:
          opt.type === 'corper' ? (this.nyscMonths.value ?? undefined) : undefined,
      });
      await this.flow.go(APPLY.salary);
    } finally {
      this.submitting.set(false);
    }
  }
}
