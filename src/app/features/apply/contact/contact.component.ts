import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../core/i18n/t.pipe';
import { LangService } from '../../../core/i18n/lang.service';
import { WizardProgressComponent } from '../wizard-progress.component';
import {
  isValidEmailShape,
  normalizePhoneNg,
  suggestEmailFix,
} from '../../../core/api/contact.util';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { PRIVACY_NOTICE_VERSION, PrivacyService } from '../../../core/privacy/privacy.service';

function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const raw = (control.value as string | null)?.trim() ?? '';
  if (!raw) return { required: true };
  return normalizePhoneNg(raw) ? null : { invalidPhone: true };
}

function emailValidator(control: AbstractControl): ValidationErrors | null {
  const raw = (control.value as string | null)?.trim() ?? '';
  if (!raw) return { required: true };
  return isValidEmailShape(raw) ? null : { invalidEmail: true };
}

@Component({
  selector: 'app-contact-step',
  imports: [ReactiveFormsModule, TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css',
})
export class ContactComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);
  protected readonly privacy = inject(PrivacyService);

  readonly form = new FormGroup({
    consent: new FormControl(!!this.state.consent(), { nonNullable: true }),
    phone: new FormControl(this.state.contact()?.phone ?? '', {
      nonNullable: true,
      validators: [Validators.required, phoneValidator],
    }),
    email: new FormControl(this.state.contact()?.email ?? '', {
      nonNullable: true,
      validators: [Validators.required, emailValidator],
    }),
  });

  private readonly emailValue = toSignal(this.form.controls.email.valueChanges, {
    initialValue: this.form.controls.email.value,
  });

  readonly emailSuggestion = computed(() => {
    const v = this.emailValue().trim();
    return isValidEmailShape(v) ? suggestEmailFix(v) : null;
  });

  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly showFieldErrors = signal(false);

  // Silence unused-injection warning while giving templates access to the current lang for re-renders.
  readonly currentLang = computed(() => this.lang.lang());

  acceptEmailSuggestion(): void {
    const s = this.emailSuggestion();
    if (s) this.form.controls.email.setValue(s);
  }

  async submit(): Promise<void> {
    this.serverError.set(null);
    this.showFieldErrors.set(true);
    if (this.form.invalid || !this.form.controls.consent.value) {
      if (!this.form.controls.consent.value) document.getElementById('consent')?.focus();
      return;
    }

    const phone = normalizePhoneNg(this.form.controls.phone.value.trim());
    const email = this.form.controls.email.value.trim().toLowerCase();
    if (!phone) return;

    this.submitting.set(true);
    try {
      // Nothing about the customer is looked up here: who is (or is not) a customer is only
      // revealed after the BVN owner confirms with an OTP, so this screen cannot be used to probe.
      this.state.setContact({ phone, email });
      this.state.setConsent({
        version: PRIVACY_NOTICE_VERSION,
        acceptedAt: new Date().toISOString(),
        language: this.lang.lang(),
      });
      await this.router.navigateByUrl('/apply/bvn');
    } catch {
      this.serverError.set(this.lang.t('step.contact.error.generic'));
    } finally {
      this.submitting.set(false);
    }
  }
}
