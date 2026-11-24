import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from '@princeps-finance/ui';
import { InputDirective } from '../../../shared/components/input/input.directive';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../../shared/components/select/select-field.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { IllustrationComponent } from '../../../shared/components/illustration.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ApiError, apiError } from '../data-access/api-error';
import { StatementReviewResponse } from '../data-access/parity-contract';
import { ParityApi } from '../data-access/parity.api';
import { ReferenceDataStore } from '../data-access/reference-data.store';

const MAX_STATEMENT_SIZE = 10 * 1024 * 1024;

@Component({
  selector: 'app-statement-review',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    InputDirective,
    SelectFieldComponent,
    SpinnerComponent,
    IllustrationComponent,
    TPipe,
  ],
  template: `
    <section class="step">
      <app-illustration name="document" />
      <header class="head">
        <h1 class="title">{{ 'step.statement.title' | t }}</h1>
        <p class="subtitle">{{ 'step.statement.subtitle' | t }}</p>
      </header>
      @if (result(); as result) {
        <div class="summary" role="status">
          <h2>{{ 'statement.received' | t }}</h2>
          <p>
            {{ 'waitlist.result.reference' | t }}: <strong>{{ result.fileId }}</strong>
          </p>
          <p>{{ 'statement.received.body' | t }}</p>
        </div>
      } @else {
        <form class="form" [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label class="label" for="statement-employer">{{ 'step.statement.employer' | t }}</label
            ><input
              appInput
              id="statement-employer"
              formControlName="employer"
              autocomplete="organization"
            />
          </div>
          <div class="field">
            <label class="label" for="statement-bank">{{ 'step.statement.bank' | t }}</label
            ><app-select-field
              inputId="statement-bank"
              [title]="'step.statement.bank' | t"
              [options]="banks()"
              [searchable]="true"
              formControlName="bankCode"
            />
          </div>
          <div class="field">
            <label class="label" for="statement-file">{{ 'step.statement.file' | t }}</label
            ><input
              id="statement-file"
              type="file"
              accept="application/pdf,.pdf"
              (change)="chooseFile($event)"
            />
            <p class="hint">{{ file()?.name || ('step.statement.hint' | t) }}</p>
            @if (fileError()) {
              <p class="error" role="alert">{{ fileError() | t }}</p>
            }
          </div>
          @if (error(); as error) {
            <p class="error" role="alert">{{ error.message }}</p>
          }
          <button appButton class="cta" [disabled]="form.invalid || !file() || pending()">
            @if (pending()) {
              <app-spinner [inline]="true" [label]="'common.loading' | t" />
            }
            {{ (pending() ? 'step.statement.sending' : 'step.statement.send') | t }}
          </button>
        </form>
      }
    </section>
  `,
  styleUrl: '../apply-step.css',
  styles: [
    `
      .head {
        display: grid;
        gap: var(--space-2);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatementComponent {
  private readonly api = inject(ParityApi);
  private readonly references = inject(ReferenceDataStore);
  private readonly destroy = inject(DestroyRef);
  readonly banks = signal<SelectOption[]>([]);
  readonly file = signal<File | null>(null);
  readonly fileError = signal('');
  readonly result = signal<StatementReviewResponse | null>(null);
  readonly pending = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly form = new FormGroup({
    employer: new FormControl('', { nonNullable: true, validators: Validators.required }),
    bankCode: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  constructor() {
    void this.loadBanks();
  }
  async loadBanks() {
    try {
      this.banks.set(
        (await this.references.banks()).map((bank) => ({ value: bank.code, label: bank.name })),
      );
    } catch (error) {
      this.error.set(apiError(error));
    }
  }
  chooseFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.file.set(null);
    this.fileError.set('');
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.fileError.set('step.statement.error.type');
      return;
    }
    if (file.size > MAX_STATEMENT_SIZE) {
      this.fileError.set('step.statement.error.size');
      return;
    }
    this.file.set(file);
  }
  async submit() {
    this.form.markAllAsTouched();
    const file = this.file();
    if (this.form.invalid || !file || this.pending()) return;
    this.pending.set(true);
    this.error.set(null);
    try {
      const value = this.form.getRawValue();
      const result = await this.api.submitStatement(file, value.employer.trim(), value.bankCode);
      if (!this.destroy.destroyed) this.result.set(result);
    } catch (error) {
      if (!this.destroy.destroyed) this.error.set(apiError(error));
    } finally {
      if (!this.destroy.destroyed) this.pending.set(false);
    }
  }
}
