import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { whatsappLink } from '../../../core/support';
import { LangService } from '../../../core/i18n/lang.service';
import { ToastService } from '../../../core/toast/toast.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

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
  private readonly flow = inject(FlowNavigator);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LangService);
  readonly support = whatsappLink('Hello Princeps, my name does not match my NIN and I need help.');

  readonly nin = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{11}$/)],
  });

  readonly submitting = signal(false);
  readonly serverError = signal<'not-found' | 'name-mismatch' | 'service-down' | null>(null);

  readonly status = toSignal(this.nin.statusChanges, { initialValue: this.nin.status });
  readonly canSubmit = computed(() => this.status() === 'VALID' && !this.submitting());

  constructor() {
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
      const profile = this.state.profile();
      if (!profile) return; // the route guard guarantees a profile; this only narrows the type
      const res = await this.api.verifyNin(this.nin.value, profile.fullName, profile.dateOfBirth);
      if (res.status !== 'ok') {
        this.serverError.set(res.status);
        return;
      }
      this.state.setNin({ value: this.nin.value, verified: true });
      this.toast.success(this.lang.t('toast.nin.ok'));
      await this.flow.go(APPLY.documents);
    } finally {
      this.submitting.set(false);
    }
  }
}
