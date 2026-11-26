import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonDirective } from '@princeps-finance/ui';
import { InputDirective } from '../../../shared/components/input/input.directive';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { AnimatedIconComponent } from '../../../shared/components/animated-icon.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ParityApi } from '../data-access/parity.api';
import { ApplicationStore } from '../state/application.store';

@Component({
  selector: 'app-nin',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    InputDirective,
    SpinnerComponent,
    AnimatedIconComponent,
    TPipe,
  ],
  template: `
    <section class="step">
      <header class="head">
        <h1 class="title">{{ 'step.nin.title' | t }}</h1>
        <p class="subtitle">{{ 'step.nin.subtitle' | t }}</p>
      </header>
      <form class="form" [formGroup]="form" (ngSubmit)="verify()">
        <div class="field">
          <label class="label" for="nin">{{ 'step.nin.label' | t }}</label
          ><input
            appInput
            id="nin"
            inputmode="numeric"
            maxlength="11"
            formControlName="nin"
            autocomplete="off"
          />
          @if (form.controls.nin.touched && form.controls.nin.invalid) {
            <p class="error" role="alert">{{ 'step.nin.invalid' | t }}</p>
          }
        </div>
        @if (store.errors()['nin']; as error) {
          <p class="error" role="alert">{{ error.message }}</p>
        }
        <button appButton class="cta" [disabled]="form.invalid || store.pending()['nin']">
          @if (store.pending()['nin']) {
            <app-spinner [inline]="true" [label]="'common.loading' | t" />
          }
          {{ (store.pending()['nin'] ? 'step.nin.verifying' : 'step.nin.verify') | t
          }}<app-animated-icon animation="arrow-right" fallback="outline-arrow-right" [size]="18" />
        </button>
      </form>
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
export class NinComponent {
  readonly store = inject(ApplicationStore);
  private readonly api = inject(ParityApi);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly form = new FormGroup({
    nin: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{11}$/)],
    }),
  });
  async verify() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const result = await this.store.run('nin', () =>
      this.api.verifyNin(this.form.controls.nin.value),
    );
    if (!result?.verified || this.destroy.destroyed) return;
    await this.store.refresh();
    if (!this.destroy.destroyed) await this.router.navigateByUrl(this.store.nextRoute());
  }
}
