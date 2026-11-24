import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonDirective } from '@princeps-finance/ui';
import {
  SelectFieldComponent,
  SelectOption,
} from '../../../shared/components/select/select-field.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AnimatedIconComponent } from '../../../shared/components/animated-icon.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ApplicationApi } from '../data-access/application.api';
import { MdaItemDto } from '../data-access/application-contract';
import { ReferenceDataStore } from '../data-access/reference-data.store';
import { ApplicationStore } from '../state/application.store';

@Component({
  selector: 'app-state-employer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    SelectFieldComponent,
    SpinnerComponent,
    AnimatedIconComponent,
    TPipe,
  ],
  template: `
    <section class="step">
      <header class="head">
        <h1 class="title">{{ 'step.state.title' | t }}</h1>
        <p class="subtitle">{{ 'step.state.subtitle' | t }}</p>
      </header>
      @if (loading()) {
        <app-spinner [label]="'common.loading' | t" />
      } @else {
        <form class="form" [formGroup]="form" (ngSubmit)="save()">
          <div class="field">
            <label class="label" for="state-employer-state">{{ 'step.state.label' | t }}</label
            ><app-select-field
              inputId="state-employer-state"
              [title]="'step.state.title' | t"
              [options]="states()"
              [searchable]="true"
              formControlName="state"
            />
          </div>
          @if (form.controls.state.value) {
            <div class="field">
              <label class="label" for="state-employer-mda">{{
                'step.state.employer.title' | t: { state: form.controls.state.value }
              }}</label
              ><app-select-field
                inputId="state-employer-mda"
                [title]="'step.state.employer.title' | t: { state: form.controls.state.value }"
                [options]="employers()"
                [searchable]="true"
                formControlName="mdaCode"
              />
            </div>
          }
          @if (store.errors()['state-save']; as error) {
            <p class="error" role="alert">{{ error.message }}</p>
          }
          <button appButton class="cta" [disabled]="form.invalid || store.pending()['state-save']">
            @if (store.pending()['state-save']) {
              <app-spinner [inline]="true" [label]="'common.loading' | t" />
            }
            {{ 'step.profile.continue' | t
            }}<app-animated-icon
              animation="arrow-right"
              fallback="outline-arrow-right"
              [size]="18"
            />
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
export class StateComponent {
  readonly store = inject(ApplicationStore);
  private readonly api = inject(ApplicationApi);
  private readonly references = inject(ReferenceDataStore);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly loading = signal(true);
  readonly mdas = signal<MdaItemDto[]>([]);
  readonly selectedState = signal('');
  readonly states = computed<SelectOption[]>(() =>
    [...new Set(this.mdas().map((mda) => mda.state))]
      .sort()
      .map((state) => ({ value: state, label: state })),
  );
  readonly employers = computed<SelectOption[]>(() =>
    this.mdas()
      .filter((mda) => mda.state === this.selectedState())
      .map((mda) => ({ value: mda.code, label: mda.name })),
  );
  readonly form = new FormGroup({
    state: new FormControl('', { nonNullable: true, validators: Validators.required }),
    mdaCode: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  constructor() {
    this.form.controls.state.valueChanges.subscribe((state) => {
      this.selectedState.set(state);
      this.form.controls.mdaCode.reset();
    });
    void this.load();
  }
  async load() {
    try {
      this.mdas.set(await this.references.mdas());
    } catch {
      /* The empty picker is a safe unavailable state. */
    } finally {
      if (!this.destroy.destroyed) this.loading.set(false);
    }
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const saved = await this.store.save('state-save', () =>
      this.api.saveEmployment({ type: 'state', mdaCode: this.form.controls.mdaCode.value }),
    );
    if (saved && !this.destroy.destroyed) await this.router.navigateByUrl('/apply/salary');
  }
}
