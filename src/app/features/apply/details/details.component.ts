import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { WizardProgressComponent } from '../wizard-progress.component';
import { AnimatedIconComponent } from '../../../shared/components/animated-icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { timer, distinctUntilChanged, switchMap, of, catchError, from } from 'rxjs';
import { ApplicationStore } from '../state/application.store';
import { OffersStore } from '../state/offers.store';
import { ApplicationApi } from '../data-access/application.api';
import { ReferenceDataStore } from '../data-access/reference-data.store';
import { ButtonDirective } from '@princeps-finance/ui';
import { InputDirective } from '../../../shared/components/input/input.directive';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../../shared/components/select/select-field.component';
import { ComboboxComponent } from '../../../shared/components/combobox/combobox.component';
import { LangService } from '../../../core/i18n/lang.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import * as ApplicationContract from '../data-access/application-contract';

import { bankOption } from './bank-option';

const wholeNumber: ValidatorFn = (control) =>
  control.value == null || Number.isInteger(control.value) ? null : { wholeNumber: true };
const requiredText: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

@Component({
  selector: 'app-details',
  imports: [
    SpinnerComponent,
    WizardProgressComponent,
    AnimatedIconComponent,
    ReactiveFormsModule,
    ButtonDirective,
    InputDirective,
    SelectFieldComponent,
    ComboboxComponent,
    TPipe,
  ],
  templateUrl: './details.component.html',
  styleUrl: '../apply-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailsComponent {
  readonly store = inject(ApplicationStore);
  private readonly offers = inject(OffersStore);
  private readonly api = inject(ApplicationApi);
  private readonly reference = inject(ReferenceDataStore);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  readonly page = this.route.snapshot.data['page'] as 'profile' | 'employment' | 'salary';
  readonly loaded = signal(false);
  readonly profile = signal<ApplicationContract.ProfileFormResponseDto | null>(null);
  readonly states = signal<SelectOption[]>([]);
  readonly lgas = signal<SelectOption[]>([]);
  readonly banks = signal<SelectOption[]>([]);
  readonly types = signal<ApplicationContract.EmploymentTypeItemDto[]>([]);
  private readonly mdas = signal<ApplicationContract.MdaItemDto[]>([]);
  readonly employers = signal<SelectOption[]>([]);

  readonly lookup = signal<ApplicationContract.ResolveAccountResponseDto | null>(null);
  readonly lookupFailed = signal(false);
  readonly lgaError = signal(false);
  readonly looking = signal(false);
  private readonly lang = inject(LangService);
  readonly relationships = computed(() =>
    ['single', 'married', 'divorced', 'widowed', 'separated'].map((value) => ({
      value,
      label: this.lang.t(
        value === 'separated'
          ? 'profile.relationship.separated'
          : 'step.profile.relationship.' + value,
      ),
    })),
  );
  readonly profileForm = new FormGroup({
    streetAddress: new FormControl('', { nonNullable: true, validators: requiredText }),
    state: new FormControl('', { nonNullable: true, validators: Validators.required }),
    lga: new FormControl('', { nonNullable: true, validators: Validators.required }),
    relationshipStatus: new FormControl<ApplicationContract.ProfileDto['relationshipStatus']>(
      'single',
      {
        nonNullable: true,
        validators: Validators.required,
      },
    ),
    email: new FormControl('', { nonNullable: true, validators: Validators.email }),
  });
  readonly employmentForm = new FormGroup({
    type: new FormControl<ApplicationContract.EmploymentDto['type'] | null>(
      null,
      Validators.required,
    ),
    mdaState: new FormControl('', { nonNullable: true }),
    mdaCode: new FormControl('', { nonNullable: true }),
    employerId: new FormControl('', { nonNullable: true }),
    monthsLeftInService: new FormControl<number | null>(null),
  });
  readonly type = toSignal(this.employmentForm.controls.type.valueChanges, { initialValue: null });
  readonly mdaState = toSignal(this.employmentForm.controls.mdaState.valueChanges, {
    initialValue: '',
  });
  readonly mdaStates = computed(() =>
    [...new Set(this.mdas().map((agency) => agency.state))]
      .sort((first, second) => first.localeCompare(second))
      .map((state) => ({ value: state, label: state })),
  );
  readonly mdaOptions = computed(() =>
    this.mdas()
      .filter((agency) => agency.state === this.mdaState())
      .map((agency) => ({ value: agency.code, label: agency.name })),
  );
  readonly employment = computed(() => this.store.application()?.employment);
  readonly salaryForm = new FormGroup({
    bankCode: new FormControl('', { nonNullable: true, validators: Validators.required }),
    accountNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{10}$/)],
    }),
    ippisNumber: new FormControl('', {
      nonNullable: true,
      validators: this.employment()?.type === 'federal' ? requiredText : null,
    }),
    serviceNumber: new FormControl('', {
      nonNullable: true,
      validators: this.employment()?.type === 'paramilitary' ? requiredText : null,
    }),
  });
  constructor() {
    this.profileForm.controls.state.valueChanges
      .pipe(
        switchMap((state) => {
          this.profileForm.controls.lga.reset();
          this.lgas.set([]);
          this.lgaError.set(false);
          return state
            ? from(this.reference.lgas(state)).pipe(
                catchError(() => {
                  this.lgaError.set(true);
                  return of(null);
                }),
              )
            : of([]);
        }),
        takeUntilDestroyed(),
      )
      .subscribe((values) => {
        if (values) this.lgas.set(values.map((value) => ({ value, label: value })));
      });
    this.salaryForm.valueChanges
      .pipe(
        distinctUntilChanged(
          (previous, current) =>
            previous.bankCode === current.bankCode &&
            previous.accountNumber === current.accountNumber,
        ),
        switchMap((value) => {
          const account = this.salaryForm.controls.accountNumber;
          if (account.hasError('server')) account.updateValueAndValidity({ emitEvent: false });
          this.lookup.set(null);
          this.lookupFailed.set(false);
          this.looking.set(false);
          const { bankCode, accountNumber } = value;
          if (!bankCode || !accountNumber || !/^\d{10}$/.test(accountNumber)) return of(null);
          this.looking.set(true);
          return timer(350).pipe(
            switchMap(() => this.api.resolveBankAccount({ bankCode, accountNumber })),
            catchError(() => {
              this.lookupFailed.set(true);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((value) => {
        this.lookup.set(value);
        this.looking.set(false);
      });
    if (this.page === 'employment') {
      const controls = this.employmentForm.controls;
      controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
        controls.mdaState.setValidators(type === 'state' ? Validators.required : null);
        controls.mdaCode.setValidators(type === 'state' ? Validators.required : null);
        controls.employerId.setValidators(type === 'paramilitary' ? Validators.required : null);
        controls.monthsLeftInService.setValidators(
          type === 'nysc'
            ? [Validators.required, Validators.min(1), Validators.max(11), wholeNumber]
            : null,
        );
        for (const control of [
          controls.mdaState,
          controls.mdaCode,
          controls.employerId,
          controls.monthsLeftInService,
        ]) {
          control.updateValueAndValidity({ emitEvent: false });
        }
        void this.loadEmploymentOptions();
      });
      controls.mdaState.valueChanges.pipe(takeUntilDestroyed()).subscribe((state) => {
        const selected = this.mdas().find((agency) => agency.code === controls.mdaCode.value);
        if (selected?.state !== state) controls.mdaCode.reset();
      });
    }
    void this.load();
  }
  async load() {
    this.loaded.set(false);
    const result = await this.store.run('details-load', async () => {
      if (this.page === 'profile') {
        const [profile, states] = await Promise.all([
          this.api.getProfile(),
          this.reference.states(),
        ]);
        return { profile, states };
      }
      if (this.page === 'employment') return { types: await this.reference.employmentTypes() };
      return { banks: await this.reference.banks() };
    });
    if (!result || this.destroy.destroyed) return;
    if (result.profile && result.states) {
      this.profile.set(result.profile);
      this.states.set(
        result.states.map((stateOption) => ({ value: stateOption.code, label: stateOption.name })),
      );
      const values = result.profile.profile;
      const state =
        result.states.find(
          (stateOption) => stateOption.code === values.state || stateOption.name === values.state,
        )?.code ?? '';
      this.profileForm.patchValue(
        {
          ...values,
          email: values.email ?? '',
          state,
          relationshipStatus: this.relationships().some(
            (relationship) => relationship.value === values.relationshipStatus,
          )
            ? (values.relationshipStatus as ApplicationContract.ProfileDto['relationshipStatus'])
            : 'single',
        },
        { emitEvent: false },
      );
      if (state) {
        const lgas = await this.store.run('lgas', () => this.reference.lgas(state));
        if (lgas && !this.destroy.destroyed)
          this.lgas.set(lgas.map((value) => ({ value, label: value })));
        else if (!this.destroy.destroyed) this.lgaError.set(true);
      }
    }
    if (result.types) {
      this.types.set(result.types);
      const saved = this.employment();
      if (saved) {
        this.employmentForm.patchValue(saved);
      } else {
        this.employmentForm.controls.type.reset();
      }
    }
    if (result.banks) {
      this.banks.set(result.banks.map(bankOption));
      const salary = this.store.application()?.salary;
      if (salary) this.salaryForm.patchValue({ bankCode: salary.bankCode });
    }
    if (!this.destroy.destroyed) this.loaded.set(true);
  }
  async loadEmploymentOptions() {
    const employmentType = this.employmentForm.controls.type.value;
    if (employmentType === 'state' && !this.mdas().length) {
      const agencies = await this.store.run('state-options', () => this.reference.mdas());
      if (agencies && !this.destroy.destroyed) {
        this.mdas.set(agencies);
        const controls = this.employmentForm.controls;
        const selected = agencies.find((agency) => agency.code === controls.mdaCode.value);
        if (controls.type.value === 'state' && selected && !controls.mdaState.value) {
          controls.mdaState.setValue(selected.state);
        }
      }
    }
    if (employmentType === 'paramilitary' && !this.employers().length) {
      const employers = await this.store.run('paramilitary-options', () =>
        this.reference.employers(),
      );
      if (employers && !this.destroy.destroyed) {
        this.employers.set(
          employers.map((employer) => ({ value: employer.id, label: employer.name })),
        );
      }
    }
  }

  retryLgas() {
    this.profileForm.controls.state.setValue(this.profileForm.controls.state.value);
  }
  chooseType(value: string) {
    if (!['federal', 'state', 'paramilitary', 'nysc'].includes(value)) return;
    this.employmentForm.controls.type.setValue(value as ApplicationContract.EmploymentDto['type']);
  }
  chooseEmploymentOption(option: ApplicationContract.EmploymentTypeItemDto) {
    if (option.status === 'AVAILABLE') {
      if (option.code === 'state') {
        void this.router.navigateByUrl('/apply/state');
        return;
      }
      this.chooseType(option.code);
      return;
    }
    const target = option.code === 'private-sector' ? '/apply/statement' : '/apply/waitlist';
    void this.router.navigate([target], { queryParams: { type: option.code } });
  }
  async save() {
    if (this.store.pending()['details-save']) return;
    let action: () => Promise<unknown>;
    let next: string;
    if (this.page === 'profile') {
      this.profileForm.markAllAsTouched();
      if (this.profileForm.invalid) return;
      const value = this.profileForm.getRawValue();
      const profileEmail = this.profile()?.profile.email?.trim();
      action = () =>
        this.api.saveProfile({
          ...value,
          streetAddress: value.streetAddress.trim(),
          email: profileEmail || value.email.trim() || undefined,
        });
      next =
        this.route.snapshot.queryParamMap.get('returnTo') === 'identity'
          ? 'verify-identity'
          : 'employment';
    } else if (this.page === 'employment') {
      this.employmentForm.markAllAsTouched();
      const value = this.employmentForm.getRawValue();
      const type = value.type;
      if (this.employmentForm.invalid || !type) return;
      action = () =>
        this.api.saveEmployment({
          type,
          ...(type === 'state' ? { mdaCode: value.mdaCode } : {}),
          ...(type === 'paramilitary' ? { employerId: value.employerId } : {}),
          ...(type === 'nysc' ? { monthsLeftInService: value.monthsLeftInService! } : {}),
        });
      next = 'salary';
    } else {
      this.salaryForm.markAllAsTouched();
      if (this.salaryForm.invalid || this.looking() || this.lookup()?.nameMatchesBvn === false)
        return;
      const value = this.salaryForm.getRawValue();
      action = () =>
        this.api.saveSalary({
          ...value,
          ippisNumber: value.ippisNumber.trim() || undefined,
          serviceNumber: value.serviceNumber.trim() || undefined,
        });
      next = 'eligibility';
    }
    const saved = await this.store.save('details-save', action);
    if (this.destroy.destroyed) return;
    if (saved) {
      this.offers.clear();
      await this.router.navigateByUrl('/apply/' + next);
    } else {
      this.showSaveFieldError();
    }
  }

  private showSaveFieldError(): void {
    const error = this.store.errors()['details-save'];
    if (!error) return;
    const profile = this.profileForm.controls;
    const employment = this.employmentForm.controls;
    const salary = this.salaryForm.controls;
    const fields: Record<string, AbstractControl> = {
      EMAIL_IN_USE: profile.email,
      STATE_INVALID: profile.state,
      RELATIONSHIP_STATUS_INVALID: profile.relationshipStatus,
      EMPLOYMENT_TYPE_UNAVAILABLE: employment.type,
      MDA_REQUIRED: employment.mdaCode,
      MDA_UNKNOWN: employment.mdaCode,
      EMPLOYER_REQUIRED: employment.employerId,
      MONTHS_LEFT_INVALID: employment.monthsLeftInService,
      BANK_UNKNOWN: salary.bankCode,
      IPPIS_REQUIRED: salary.ippisNumber,
      SERVICE_NUMBER_REQUIRED: salary.serviceNumber,
      ACCOUNT_NAME_MISMATCH: salary.accountNumber,
      ACCOUNT_NOT_FOUND: salary.accountNumber,
    };
    if (!Object.hasOwn(fields, error.code)) return;
    const field = fields[error.code];
    field.markAsTouched();
    field.setErrors({ ...field.errors, server: error.message });
    this.store.clearError('details-save');
  }
}
