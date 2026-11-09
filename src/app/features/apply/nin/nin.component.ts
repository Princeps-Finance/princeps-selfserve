import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { ToastService } from '../../../core/toast/toast.service';

@Component({
  selector: 'app-nin',
  imports: [TPipe, WizardProgressComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nin.component.html',
  styleUrl: './nin.component.css',
})
export class NinComponent {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly nin = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{11}$/)],
  });

  readonly submitting = signal(false);
  readonly serverError = signal<'not-found' | 'name-mismatch' | 'service-down' | null>(null);

  readonly status = toSignal(this.nin.statusChanges, { initialValue: this.nin.status });
  readonly canSubmit = computed(() => this.status() === 'VALID' && !this.submitting());

  constructor() {
    if (!this.state.bvn()?.verified) {
      void this.router.navigateByUrl('/apply/bvn');
      return;
    }
    const saved = this.state.nin();
    if (saved) this.nin.setValue(saved.value);
  }

  onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digitsOnly = el.value.replace(/\D/g, '').slice(0, 11);
    if (digitsOnly !== el.value) {
      el.value = digitsOnly;
      this.nin.setValue(digitsOnly);
    }
  }

  errorKey(): string | null {
    const e = this.serverError();
    if (!e) return null;
    if (e === 'not-found') return 'step.nin.error.not.found';
    if (e === 'name-mismatch') return 'step.nin.error.mismatch';
    return 'step.nin.error.service';
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    if (this.nin.invalid) {
      this.nin.markAsTouched();
      focusFirstInvalid();
      return;
    }
    this.submitting.set(true);
    this.serverError.set(null);
    try {
      const bvnMatchedName = this.state.bvn()?.matchedName ?? '';
      const res = await this.api.verifyNin(this.nin.value, bvnMatchedName);
      if (res.status !== 'ok') {
        this.serverError.set(res.status);
        if (res.status === 'not-found') this.toast.error('NIN not found. Check the 11 digits and try again.');
        else if (res.status === 'name-mismatch') this.toast.error('NIN name doesn\'t match your BVN. Please check the NIN.');
        else this.toast.error('NIN service unavailable. Try again in a moment.');
        return;
      }
      this.state.setNin({ value: this.nin.value, verified: true });
      this.toast.success('NIN verified');
      await this.router.navigateByUrl('/apply/profile');
    } finally {
      this.submitting.set(false);
    }
  }
}
