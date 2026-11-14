import { InputDirective } from '../../../shared/components/input/input.directive';
import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SelectFieldComponent } from '../../../shared/components/select/select-field.component';
import { ComboboxComponent } from '../../../shared/components/combobox/combobox.component';
import type { SelectOption } from '../../../shared/components/select/select-option';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { API_CLIENT } from '../../../core/api/api-client';
import {
  ApplicationStateService,
  SalaryChannel,
} from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

const PARAMILITARY_EMPLOYERS = [
  'NSCDC',
  'Nigerian Correctional Services',
  'Nigeria Immigration',
  'Adamawa State SUBEB',
  'Other (manual review)',
];

@Component({
  selector: 'app-salary',
  imports: [InputDirective, ButtonDirective, TPipe, WizardProgressComponent, ReactiveFormsModule, SelectFieldComponent, ComboboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salary.component.html',
  styleUrl: './salary.component.css',
})
export class SalaryComponent {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  readonly channel = signal<SalaryChannel>(this.deriveChannel());
  readonly showChannelChoice = computed(() => this.state.employment()?.type === 'government');
  readonly paramilitaryEmployers = PARAMILITARY_EMPLOYERS;
  readonly employerOptions: SelectOption[] = PARAMILITARY_EMPLOYERS.map((e) => ({ value: e, label: e }));

  setChannel(c: SalaryChannel): void {
    this.channel.set(c);
    this.serverError.set(null);
  }

  readonly bankOptions = signal<readonly SelectOption[]>([]);

  readonly form = new FormGroup({
    bankCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    accountNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{10}$/)],
    }),
    ippisNumber: new FormControl<string>('', { nonNullable: true }),
    employer: new FormControl<string>('', { nonNullable: true }),
  });

  readonly submitting = signal(false);
  readonly serverError = signal<'not-found' | 'name-mismatch' | 'service-down' | null>(null);

  readonly statusChanges = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  readonly valueChanges = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  readonly attempted = signal(false);

  invalid(name: 'bankCode' | 'accountNumber' | 'ippisNumber' | 'employer'): true | null {
    if (!this.attempted()) return null;
    const c = this.form.controls[name];
    let bad = c.invalid;
    if (name === 'ippisNumber') bad = this.needsIppis() && !/^\d+$/.test(c.value);
    if (name === 'employer') bad = this.channel() === 'dedukt' && !c.value;
    return bad ? true : null;
  }

  readonly canSubmit = computed(() => {
    this.statusChanges();
    this.valueChanges();
    if (this.form.invalid) return false;
    if (this.needsIppis() && !/^\d+$/.test(this.form.controls.ippisNumber.value)) return false;
    if (this.channel() === 'dedukt' && !this.form.controls.employer.value) return false;
    return true;
  });

  constructor() {
    const saved = this.state.salary();
    if (saved?.bankCode) this.bankOptions.set([{ value: saved.bankCode, label: saved.bankName }]);
    void this.loadBanks();

    // Rehydrate.
    if (saved) {
      this.form.patchValue({
        bankCode: saved.bankCode,
        accountNumber: saved.accountNumber,
        ippisNumber: saved.ippisNumber ?? '',
        employer: saved.paramilitaryEmployer ?? '',
      });
    }
  }

  needsIppis(): boolean {
    return this.channel() === 'ippis' || this.channel() === 'dedukt';
  }

  titleKey(): string {
    return `step.salary.${this.channel()}.title`;
  }

  subtitleKey(): string {
    return `step.salary.${this.channel()}.subtitle`;
  }

  private async loadBanks(): Promise<void> {
    const banks = await this.api.listBanks();
    const options = banks.map(({ code, name }) => ({ value: code, label: name }));
    const restored = this.bankOptions()[0];
    if (restored && !options.some((option) => option.value === restored.value)) {
      options.unshift(restored);
    }
    this.bankOptions.set(options);
  }

  errorKey(): string | null {
    const e = this.serverError();
    if (!e) return null;
    if (e === 'not-found') return 'step.salary.error.not.found';
    if (e === 'name-mismatch') return 'step.salary.error.mismatch';
    return 'step.salary.error.service';
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    const v = this.form.getRawValue();
    const bank = this.bankOptions().find((option) => option.value === v.bankCode);
    if (!this.canSubmit() || !bank) {
      this.attempted.set(true);
      this.form.markAllAsTouched();
      setTimeout(() => focusFirstInvalid());
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);
    try {
      const res = await this.api.verifySalary({
        channel: this.channel(),
        bankCode: v.bankCode,
        accountNumber: v.accountNumber,
        fullName: this.state.profile()?.fullName ?? '',
        ippisNumber: v.ippisNumber || undefined,
        employer: v.employer || undefined,
      });
      if (res.status !== 'ok') {
        this.serverError.set(res.status);
        return;
      }
      this.state.setSalary({
        channel: this.channel(),
        bankCode: v.bankCode,
        bankName: bank.label,
        accountNumber: v.accountNumber,
        ippisNumber: v.ippisNumber || undefined,
        paramilitaryEmployer: v.employer || undefined,
        monthlyIncome: res.monthlyIncome,
      });
      await this.flow.go(APPLY.eligibility);
    } finally {
      this.submitting.set(false);
    }
  }

  private deriveChannel(): SalaryChannel {
    const t = this.state.employment()?.type;
    if (t === 'paramilitary') return 'dedukt';
    if (t === 'corper') return 'remita';
    return 'ippis'; // government default
  }
}
