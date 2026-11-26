import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from '@princeps-finance/ui';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { InputDirective } from '../../../shared/components/input/input.directive';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../../shared/components/select/select-field.component';
import { AnimatedIconComponent } from '../../../shared/components/animated-icon.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ReferenceDataStore } from '../data-access/reference-data.store';
import { MdaItemDto } from '../data-access/application-contract';
import { ParityApi } from '../data-access/parity.api';
import { CheckFlowService, PreviewEmployment } from './check-flow.service';

@Component({
  selector: 'app-check-flow',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    SpinnerComponent,
    InputDirective,
    SelectFieldComponent,
    AnimatedIconComponent,
    TPipe,
  ],
  template: `
    <section class="step">
      @switch (page) {
        @case ('employment') {
          <header class="head">
            <p class="eyebrow">{{ 'check.eyebrow' | t }}</p>
            <h1 class="title">{{ 'step.employment.title' | t }}</h1>
            <p class="subtitle">{{ 'step.employment.subtitle' | t }}</p>
          </header>
          @if (loading()) {
            <app-spinner [label]="'common.loading' | t" />
          } @else if (loadError()) {
            <p class="error" role="alert">{{ 'check.unavailable' | t }}</p>
            <button appButton variant="secondary" type="button" (click)="loadEmployment()">
              {{ 'common.retry' | t }}
            </button>
          } @else {
            <div class="choices" role="radiogroup" [attr.aria-label]="'step.employment.title' | t">
              @for (option of employmentOptions(); track option.value) {
                <button
                  type="button"
                  class="choice employment-choice"
                  role="radio"
                  [attr.aria-checked]="flow.employmentType() === option.value"
                  (click)="chooseEmployment(option.value)"
                >
                  <span class="choice-copy"
                    ><strong>{{ option.label }}</strong></span
                  >
                  <span class="choice-mark" aria-hidden="true"></span>
                </button>
              }
            </div>
          }
        }
        @case ('state') {
          <header class="head">
            <p class="eyebrow">{{ 'check.eyebrow' | t }}</p>
            <h1 class="title">{{ 'step.state.title' | t }}</h1>
            <p class="subtitle">{{ 'step.state.subtitle' | t }}</p>
          </header>
          @if (loading()) {
            <app-spinner [label]="'common.loading' | t" />
          } @else {
            <form class="form" [formGroup]="stateForm" (ngSubmit)="saveState()">
              <div class="field">
                <label class="label" for="preview-state">{{ 'step.state.label' | t }}</label>
                <app-select-field
                  inputId="preview-state"
                  [title]="'step.state.title' | t"
                  [options]="stateOptions()"
                  [searchable]="true"
                  formControlName="state"
                />
              </div>
              @if (selectedState()) {
                <div class="field">
                  <label class="label" for="preview-mda">{{ 'employment.mda' | t }}</label>
                  <app-select-field
                    inputId="preview-mda"
                    [title]="'employment.mda' | t"
                    [options]="mdaOptions()"
                    [searchable]="true"
                    formControlName="mdaCode"
                  />
                </div>
              }
              <button appButton class="cta" [disabled]="stateForm.invalid">
                {{ 'step.profile.continue' | t }}
                <app-animated-icon
                  animation="arrow-right"
                  fallback="outline-arrow-right"
                  [size]="18"
                />
              </button>
            </form>
          }
        }
        @default {
          <header class="head">
            <p class="eyebrow">{{ 'check.eyebrow' | t }}</p>
            <h1 class="title">{{ 'check.salary.title' | t }}</h1>
            <p class="subtitle">{{ 'check.salary.subtitle' | t }}</p>
          </header>
          @if (loading()) {
            <app-spinner [label]="'common.loading' | t" />
          } @else {
            <form class="form" [formGroup]="salaryForm" (ngSubmit)="check()">
              <div class="field">
                <label class="label" for="preview-bank">{{ 'step.salary.bank.label' | t }}</label>
                <app-select-field
                  inputId="preview-bank"
                  [title]="'step.salary.bank.label' | t"
                  [options]="banks()"
                  [searchable]="true"
                  formControlName="bankCode"
                />
              </div>
              <div class="field">
                <label class="label" for="preview-account">{{
                  'step.salary.account.label' | t
                }}</label>
                <input
                  appInput
                  id="preview-account"
                  inputmode="numeric"
                  maxlength="10"
                  formControlName="accountNumber"
                  autocomplete="off"
                />
              </div>
              <div class="field">
                <label class="label" for="preview-account-name">{{
                  'check.accountName' | t
                }}</label>
                <input
                  appInput
                  id="preview-account-name"
                  formControlName="accountName"
                  autocomplete="name"
                />
              </div>
              @if (flow.employmentType() === 'federal') {
                <div class="field">
                  <label class="label" for="preview-ippis">{{
                    'step.salary.ippis.label' | t
                  }}</label>
                  <input appInput id="preview-ippis" formControlName="ippisNumber" />
                </div>
              }
              @if (flow.employmentType() === 'state' || flow.employmentType() === 'paramilitary') {
                <div class="field">
                  <label class="label" for="preview-service">{{
                    'salary.serviceNumber' | t
                  }}</label>
                  <input appInput id="preview-service" formControlName="serviceNumber" />
                </div>
              }
              @if (flow.employmentType() === 'paramilitary') {
                <div class="field">
                  <label class="label" for="preview-employer">{{ 'check.employer' | t }}</label>
                  <app-select-field
                    inputId="preview-employer"
                    [title]="'check.employer' | t"
                    [options]="employerOptions()"
                    [searchable]="true"
                    formControlName="employerId"
                  />
                </div>
              }
              @if (flow.employmentType() === 'nysc') {
                <div class="field">
                  <label class="label" for="preview-months">{{
                    'step.employment.corper.months.label' | t
                  }}</label>
                  <input
                    appInput
                    id="preview-months"
                    type="number"
                    min="1"
                    max="11"
                    formControlName="monthsLeftInService"
                  />
                </div>
              }
              <div class="field">
                <label class="label" for="preview-bvn">{{ 'step.bvn.label' | t }}</label>
                <input
                  appInput
                  id="preview-bvn"
                  inputmode="numeric"
                  maxlength="11"
                  formControlName="bvn"
                  autocomplete="off"
                />
              </div>
              <div class="field">
                <label class="label" for="preview-first-name">{{ 'check.firstName' | t }}</label>
                <input
                  appInput
                  id="preview-first-name"
                  formControlName="firstName"
                  autocomplete="given-name"
                />
              </div>
              <div class="field">
                <label class="label" for="preview-last-name">{{ 'check.lastName' | t }}</label>
                <input
                  appInput
                  id="preview-last-name"
                  formControlName="lastName"
                  autocomplete="family-name"
                />
              </div>
              @if (flow.error(); as error) {
                <p class="error" role="alert">{{ error.message }}</p>
              }
              <button appButton class="cta" [disabled]="salaryForm.invalid || flow.pending()">
                @if (flow.pending()) {
                  <app-spinner [inline]="true" [label]="'common.loading' | t" />
                }
                {{ 'step.salary.check.continue' | t }}
                <app-animated-icon
                  animation="arrow-right"
                  fallback="outline-arrow-right"
                  [size]="18"
                />
              </button>
            </form>
          }
        }
      }
    </section>
  `,
  styleUrl: '../apply-step.css',
  styles: [
    `
      .eyebrow {
        margin: 0;
        color: var(--text-accent);
        font-size: var(--fs-sm);
        font-weight: 600;
      }
      .head {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckFlowComponent {
  readonly page = inject(ActivatedRoute).snapshot.data['page'] as 'employment' | 'state' | 'salary';
  readonly flow = inject(CheckFlowService);
  private readonly references = inject(ReferenceDataStore);
  private readonly api = inject(ParityApi);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly employmentOptions = signal<SelectOption[]>([]);
  readonly mdas = signal<MdaItemDto[]>([]);
  readonly selectedState = signal('');
  readonly stateOptions = computed<SelectOption[]>(() =>
    [...new Set(this.mdas().map((mda) => mda.state))]
      .sort()
      .map((state) => ({ value: state, label: state })),
  );
  readonly mdaOptions = computed<SelectOption[]>(() =>
    this.mdas()
      .filter((mda) => mda.state === this.selectedState())
      .map((mda) => ({ value: mda.code, label: mda.name })),
  );
  readonly banks = signal<SelectOption[]>([]);
  readonly employerOptions = signal<SelectOption[]>([]);
  readonly stateForm = new FormGroup({
    state: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    mdaCode: new FormControl(this.flow.mdaCode(), {
      nonNullable: true,
      validators: Validators.required,
    }),
  });
  readonly salaryForm = new FormGroup({
    bankCode: new FormControl('', { nonNullable: true, validators: Validators.required }),
    accountNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{10}$/)],
    }),
    accountName: new FormControl('', { nonNullable: true, validators: Validators.required }),
    ippisNumber: new FormControl('', {
      nonNullable: true,
      validators: this.flow.employmentType() === 'federal' ? Validators.required : [],
    }),
    serviceNumber: new FormControl('', {
      nonNullable: true,
      validators: ['state', 'paramilitary'].includes(this.flow.employmentType() ?? '')
        ? Validators.required
        : [],
    }),
    employerId: new FormControl(this.flow.employerId(), {
      nonNullable: true,
      validators: this.flow.employmentType() === 'paramilitary' ? Validators.required : [],
    }),
    monthsLeftInService: new FormControl<number | null>(null, {
      validators:
        this.flow.employmentType() === 'nysc'
          ? [Validators.required, Validators.min(1), Validators.max(11)]
          : [],
    }),
    bvn: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{11}$/)],
    }),
    firstName: new FormControl('', { nonNullable: true, validators: Validators.required }),
    lastName: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  constructor() {
    if (this.page !== 'employment' && !this.flow.employmentType()) {
      void this.router.navigateByUrl('/apply/check/employment', { replaceUrl: true });
      return;
    }
    this.stateForm.controls.state.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((state) => {
        this.selectedState.set(state);
        this.stateForm.controls.mdaCode.reset();
      });
    if (this.page === 'employment') void this.loadEmployment();
    if (this.page === 'state') void this.loadStates();
    if (this.page === 'salary') void this.loadBanks();
  }

  async loadEmployment() {
    await this.load(async () => {
      const values = await this.references.employmentTypes();
      this.employmentOptions.set(
        values
          .filter((value) => value.status === 'AVAILABLE')
          .filter((value) => ['federal', 'state', 'paramilitary', 'nysc'].includes(value.code))
          .map((value) => ({ value: value.code, label: value.name })),
      );
    });
  }

  private async loadStates() {
    await this.load(async () => {
      const mdas = await this.references.mdas();
      this.mdas.set(mdas);
      const selected = mdas.find((mda) => mda.code === this.flow.mdaCode());
      if (selected) {
        this.stateForm.controls.state.setValue(selected.state);
        this.stateForm.controls.mdaCode.setValue(selected.code);
      }
    });
  }

  private async loadBanks() {
    await this.load(async () => {
      const [banks, employers] = await Promise.all([
        this.references.banks(),
        this.flow.employmentType() === 'paramilitary'
          ? this.references.employers()
          : Promise.resolve([]),
      ]);
      this.banks.set(banks.map((value) => ({ value: value.code, label: value.name })));
      this.employerOptions.set(employers.map((value) => ({ value: value.id, label: value.name })));
    });
  }

  private async load(work: () => Promise<void>) {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      await work();
    } catch {
      this.loadError.set(true);
    } finally {
      if (!this.destroy.destroyed) this.loading.set(false);
    }
  }

  chooseEmployment(value: string) {
    if (!['federal', 'state', 'paramilitary', 'nysc'].includes(value)) return;
    this.flow.chooseEmployment(value as PreviewEmployment);
    void this.router.navigateByUrl(
      value === 'state' ? '/apply/check/state' : '/apply/check/salary',
    );
  }

  saveState() {
    this.stateForm.markAllAsTouched();
    if (this.stateForm.invalid) return;
    this.flow.mdaCode.set(this.stateForm.controls.mdaCode.value);
    void this.router.navigateByUrl('/apply/check/salary');
  }

  async check() {
    this.salaryForm.markAllAsTouched();
    if (this.salaryForm.invalid) return;
    const value = this.salaryForm.getRawValue();
    if (this.flow.employmentType() === 'paramilitary') {
      this.flow.employerId.set(value.employerId);
    }
    const ok = await this.flow.evaluate(this.api, {
      bank: {
        bankCode: value.bankCode,
        accountNumber: value.accountNumber,
        accountName: value.accountName.trim(),
        ...(value.ippisNumber.trim() ? { ippisNumber: value.ippisNumber.trim() } : {}),
        ...(value.serviceNumber.trim() ? { serviceNumber: value.serviceNumber.trim() } : {}),
      },
      identity: {
        bvn: value.bvn,
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
      },
      ...(value.monthsLeftInService ? { monthsLeftInService: value.monthsLeftInService } : {}),
    });
    if (ok && !this.destroy.destroyed) await this.router.navigateByUrl('/apply/check-result');
  }
}
