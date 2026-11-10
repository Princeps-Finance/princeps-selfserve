import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SelectFieldComponent, SelectOption } from '../../../core/ui/select-field.component';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { API_CLIENT, Bank } from '../../../core/api/api-client';
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
  imports: [TPipe, WizardProgressComponent, ReactiveFormsModule, SelectFieldComponent],
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

  readonly banks = signal<Bank[]>([]);
  readonly bankQuery = signal('');
  readonly bankOpen = signal(false);
  readonly activeBank = signal(-1);

  readonly filteredBanks = computed(() => {
    const q = this.bankQuery().trim().toLowerCase();
    const list = this.banks();
    if (!q) return list;
    return list.filter((b) => b.name.toLowerCase().includes(q));
  });

  readonly form = new FormGroup({
    bankCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    bankName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
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
    void this.api.listBanks().then((b) => this.banks.set(b));

    // Rehydrate.
    const saved = this.state.salary();
    if (saved) {
      this.form.patchValue({
        bankCode: saved.bankCode,
        bankName: saved.bankName,
        accountNumber: saved.accountNumber,
        ippisNumber: saved.ippisNumber ?? '',
        employer: saved.paramilitaryEmployer ?? '',
      });
      this.bankQuery.set(saved.bankName);
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

  onBankFocus(): void {
    this.bankOpen.set(true);
  }

  onBankKeydown(evt: KeyboardEvent): void {
    const list = this.filteredBanks();
    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      evt.preventDefault();
      if (!list.length) return;
      this.bankOpen.set(true);
      const step = evt.key === 'ArrowDown' ? 1 : -1;
      this.activeBank.update((i) => (i + step + list.length) % list.length);
    } else if (evt.key === 'Enter' && this.bankOpen() && this.activeBank() >= 0) {
      evt.preventDefault();
      this.pickBank(list[this.activeBank()]);
    } else if (evt.key === 'Escape' && this.bankOpen()) {
      evt.preventDefault();
      this.bankOpen.set(false);
    }
  }

  onBankInput(evt: Event): void {
    this.activeBank.set(-1);
    const v = (evt.target as HTMLInputElement).value;
    this.bankQuery.set(v);
    this.bankOpen.set(true);
    this.form.controls.bankCode.setValue('');
    this.form.controls.bankName.setValue('');
  }

  onBankBlur(): void {
    // Delay so option click registers.
    setTimeout(() => this.bankOpen.set(false), 150);
  }

  pickBank(bank: Bank): void {
    this.form.controls.bankCode.setValue(bank.code);
    this.form.controls.bankName.setValue(bank.name);
    this.bankQuery.set(bank.name);
    this.bankOpen.set(false);
    this.activeBank.set(-1);
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
    if (!this.canSubmit()) {
      this.attempted.set(true);
      this.form.markAllAsTouched();
      setTimeout(() => focusFirstInvalid());
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);
    const v = this.form.getRawValue();
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
        bankName: v.bankName,
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
