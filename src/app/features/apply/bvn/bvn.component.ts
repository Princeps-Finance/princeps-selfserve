import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { whatsappLink } from '../../../core/support';
import { LangService } from '../../../core/i18n/lang.service';
import { productById } from '../../../core/products/products';
import { ToastService } from '../../../core/toast/toast.service';

@Component({
  selector: 'app-bvn',
  imports: [TPipe, WizardProgressComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bvn.component.html',
  styleUrl: './bvn.component.css',
})
export class BvnComponent {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LangService);
  readonly support = whatsappLink('Hello Princeps, my name does not match my BVN and I need help.');

  readonly bvn = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{11}$/)],
  });

  readonly submitting = signal(false);
  readonly serverError = signal<'not-found' | 'name-mismatch' | 'service-down' | null>(null);

  readonly status = toSignal(this.bvn.statusChanges, { initialValue: this.bvn.status });
  readonly canSubmit = computed(() => this.status() === 'VALID' && !this.submitting());

  constructor() {
    if (!this.state.termsAcceptedAt() || !this.state.profile()) {
      void this.router.navigateByUrl('/apply/terms');
      return;
    }
    const saved = this.state.bvn();
    if (saved) this.bvn.setValue(saved.value);
  }

  onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digitsOnly = el.value.replace(/\D/g, '').slice(0, 11);
    if (digitsOnly !== el.value) {
      el.value = digitsOnly;
      this.bvn.setValue(digitsOnly);
    }
  }

  errorKey(): string | null {
    const e = this.serverError();
    if (!e) return null;
    if (e === 'not-found') return 'step.bvn.error.not.found';
    if (e === 'name-mismatch') return 'step.bvn.error.mismatch';
    return 'step.bvn.error.service';
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    if (this.bvn.invalid) {
      this.bvn.markAsTouched();
      focusFirstInvalid();
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);
    try {
      const profile = this.state.profile()!;
      const res = await this.api.verifyBvn(this.bvn.value, profile.fullName, profile.dateOfBirth);
      if (res.status !== 'ok') {
        this.serverError.set(res.status);
        return;
      }
      this.state.setBvn({ value: this.bvn.value, verified: true });
      this.toast.success(this.lang.t('toast.bvn.ok'));
      const product = productById(this.state.offer()?.productId ?? '');
      await this.router.navigateByUrl(product?.settings.requiresNin ? '/apply/nin' : '/apply/documents');
    } finally {
      this.submitting.set(false);
    }
  }
}
