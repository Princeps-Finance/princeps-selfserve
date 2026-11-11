import { IconComponent } from '../../../shared/icon.component';
import { AnimatedIconComponent } from '../../../shared/animated-icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { API_CLIENT } from '../../../core/api/api-client';
import { availabilityByType } from '../../../core/api/employment-availability';
import { CardComponent } from '../../../shared/card.component';
import { ModalComponent } from '../../../shared/modal.component';
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
  /** Unique per row: government appears twice (federal and state). */
  key: string;
  type: EmploymentType;
  level?: 'federal' | 'state';
  labelKey: string;
  hintKey: string;
  live: boolean;
}

const OPTIONS: Option[] = [
  { key: 'government-federal', type: 'government', level: 'federal', labelKey: 'step.employment.federal', hintKey: 'step.employment.federal.hint', live: true },
  { key: 'government-state', type: 'government', level: 'state', labelKey: 'step.employment.state', hintKey: 'step.employment.state.hint', live: true },
  { key: 'paramilitary', type: 'paramilitary', labelKey: 'step.employment.paramilitary', hintKey: 'step.employment.paramilitary.hint', live: true },
  { key: 'corper', type: 'corper', labelKey: 'step.employment.corper', hintKey: 'step.employment.corper.hint', live: true },
  { key: 'private-sector', type: 'private-sector', labelKey: 'step.employment.private', hintKey: 'step.employment.private.hint', live: true },
  { key: 'own-business', type: 'own-business', labelKey: 'step.employment.business', hintKey: 'step.employment.business.hint', live: false },
];

@Component({
  selector: 'app-employment',
  imports: [IconComponent, AnimatedIconComponent, CardComponent, ModalComponent, TPipe, WizardProgressComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employment.component.html',
  styleUrl: './employment.component.css',
})
export class EmploymentComponent implements OnInit {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly api = inject(API_CLIENT);

  /** Only segments we can serve now are options. The rest are a single waitlist link, not disabled-looking rows. */
  /** What the back end says is open right now. Empty until it answers, or for good if it cannot be reached. */
  private readonly open = signal<Partial<Record<EmploymentType, boolean>>>({});
  readonly options = computed(() => OPTIONS.map((o) => ({ ...o, live: this.open()[o.type] ?? o.live })));
  /** Which row is picked. Government has two rows, so the type alone is not enough. */
  readonly selectedKey = signal<string | null>(this.initialKey());
  /** The months-left sheet for a corper. */
  readonly corperOpen = signal(false);
  readonly selected = computed<EmploymentType | null>(() => OPTIONS.find((o) => o.key === this.selectedKey())?.type ?? null);
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
    this.options().find((o) => o.key === this.selectedKey()) ?? null,
  );
  readonly canContinue = computed(() => {
    const opt = this.selectedOption();
    if (!opt) return false;
    if (!opt.live) return true;
    if (opt.type === 'corper') return this.nyscMonths.valid && !this.tooShort();
    return true;
  });

  async ngOnInit(): Promise<void> {
    const rows = await this.api.getEmploymentTypes();
    if (rows) this.open.set(availabilityByType(rows));
  }

  onMonthsInput(): void {
    this.months.set(this.nyscMonths.value);
  }

  /** One tap moves on. Only a corper needs one more answer (months left), so only they get a button. */
  select(opt: Option): void {
    this.selectedKey.set(opt.key);
    this.attempted.set(false);
    if (opt.type === 'corper') this.corperOpen.set(true);
    else void this.continue();
  }

  private initialKey(): string | null {
    // The how-much-can-I-get check never starts with a row picked, not even after "Check again" or a reload.
    if (this.state.intent() === 'check') return null;
    const e = this.state.employment();
    if (!e) return null;
    return OPTIONS.find((o) => o.type === e.type && (o.level ?? e.governmentLevel) === e.governmentLevel)?.key ?? OPTIONS.find((o) => o.type === e.type)?.key ?? null;
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
        governmentLevel: opt.level,
        nyscMonthsRemaining:
          opt.type === 'corper' ? (this.nyscMonths.value ?? undefined) : undefined,
      });
      await this.flow.go(APPLY.salary);
    } finally {
      this.submitting.set(false);
    }
  }
}
