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

  readonly bvn = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{11}$/)],
  });

  readonly submitting = signal(false);
  readonly serverError = signal<'not-found' | 'name-mismatch' | 'service-down' | null>(null);

  readonly status = toSignal(this.bvn.statusChanges, { initialValue: this.bvn.status });
  readonly canSubmit = computed(() => this.status() === 'VALID' && !this.submitting());

  constructor() {
    if (!this.state.salary()) {
      void this.router.navigateByUrl('/apply/salary');
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
      const res = await this.api.verifyBvn(this.bvn.value, '');
      if (res.status !== 'ok') {
        this.serverError.set(res.status);
        if (res.status === 'not-found') this.toast.error('BVN not found. Check the 11 digits and try again.');
        else if (res.status === 'name-mismatch') this.toast.error('BVN name doesn\'t match. Please check the BVN.');
        else this.toast.error('BVN service unavailable. Try again in a moment.');
        return;
      }
      this.state.setBvn({
        value: this.bvn.value,
        verified: true,
        matchedName: res.matchedName,
        dateOfBirth: res.dateOfBirth,
        phone: res.phone,
        address: res.address,
      });
      this.toast.success(`BVN verified · ${res.matchedName}`);
      await this.router.navigateByUrl('/apply/nin');
    } finally {
      this.submitting.set(false);
    }
  }
}
