import { AnimatedIconComponent } from '../../../shared/animated-icon.component';
import { WhyAskComponent } from '../../../shared/why-ask.component';
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
import { ModalComponent } from '../../../shared/modal.component';
import { telLink, whatsappLink } from '../../../core/support';
import { CaptchaService } from '../../../core/captcha/captcha.service';

const PARAMILITARY_EMPLOYERS = [
  'NSCDC',
  'Nigerian Correctional Services',
  'Nigeria Immigration',
  'Adamawa State SUBEB',
  'Other (manual review)',
];

@Component({
  selector: 'app-salary',
  imports: [AnimatedIconComponent, WhyAskComponent, TPipe, WizardProgressComponent, ReactiveFormsModule, SelectFieldComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salary.component.html',
  styleUrl: './salary.component.css',
})
export class SalaryComponent {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly captcha = inject(CaptchaService);

  /**
   * check: the no-identity "how much can I get" check. The salary account is asked and the back end does the real
   *        employment and salary check; nothing is verified against a name yet.
   * verify: after identity, when the account was already given in the check. It is checked again, silently, against
   *         the name from the BVN, and the real pay replaces the estimate.
   * full: the normal application.
   */
  readonly mode: 'check' | 'verify' | 'full' =
    this.state.intent() === 'check' ? 'check' : this.state.salary()?.fromCheck ? 'verify' : 'full';

  readonly channel = signal<SalaryChannel>(this.deriveChannel());
  /** Federal government is paid through IPPIS and state government through Remita, so the choice is only asked when the level is unknown. */
  readonly showChannelChoice = computed(() => this.state.employment()?.type === 'government' && !this.state.employment()?.governmentLevel);
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
  /** True when the limit on checks was reached: a window explains it. */
  readonly limited = signal(false);
  readonly whatsapp = whatsappLink('Hello Princeps, I reached the limit on checking how much I can get and I would like help.');
  readonly tel = telLink();
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
    // The account came from the check: verify it now without asking again. If it fails, the form below shows why.
    if (this.mode === 'verify' && saved && saved.accountNumber) queueMicrotask(() => void this.submit());
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
    if (this.mode === 'check') {
      try {
        const employment = this.state.employment();
        const res = await this.api.checkEligibility({
          employmentType: employment?.type === 'paramilitary' || employment?.type === 'corper' ? employment.type : 'government',
          governmentLevel: employment?.governmentLevel,
          nyscMonthsRemaining: employment?.nyscMonthsRemaining,
          channel: this.channel(),
          bankCode: v.bankCode,
          accountNumber: v.accountNumber,
          ippisNumber: v.ippisNumber || undefined,
          employer: v.employer || undefined,
          captchaToken: await this.captcha.token(),
        });
        if (res.status === 'rate-limited') {
          this.limited.set(true);
          return;
        }
        if (res.status !== 'ok') {
          this.serverError.set(res.status);
          return;
        }
        // The account is kept, so it is not asked again after identity. Pay is not known yet: it is verified then.
        this.state.setSalary({
          channel: this.channel(),
          bankCode: v.bankCode,
          bankName: v.bankName,
          accountNumber: v.accountNumber,
          ippisNumber: v.ippisNumber || undefined,
          paramilitaryEmployer: v.employer || undefined,
          monthlyIncome: res.monthlyIncome,
          fromCheck: true,
        });
        this.state.setEligibility({ score: 0, decision: res.decision, maxEligibleAmount: res.maxAmount, tenorMonths: res.tenorMonths, reasons: [] });
        await this.flow.go(APPLY.checkResult);
      } finally {
        this.submitting.set(false);
      }
      return;
    }
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
    const saved = this.state.salary();
    if (saved) return saved.channel;
    const e = this.state.employment();
    const t = e?.type;
    if (t === 'government' && e?.governmentLevel === 'state') return 'remita';
    if (t === 'paramilitary') return 'dedukt';
    if (t === 'corper') return 'remita';
    return 'ippis'; // government default
  }
}
