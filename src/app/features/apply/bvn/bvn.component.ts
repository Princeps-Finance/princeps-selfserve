import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { whatsappLink } from '../../../core/support';
import { LangService } from '../../../core/i18n/lang.service';
import { PRIVACY_NOTICE_VERSION, PrivacyService } from '../../../core/privacy/privacy.service';

/**
 * The BVN is asked first. We then text a code to the phone linked to that BVN, so only its real
 * owner can continue, and the owner's details fill the form for them.
 */
@Component({
  selector: 'app-bvn',
  imports: [TPipe, WizardProgressComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bvn.component.html',
  styleUrl: './bvn.component.css',
})
export class BvnComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);
  protected readonly privacy = inject(PrivacyService);
  readonly support = whatsappLink('Hello Princeps, I need help with my BVN.');

  readonly bvn = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{11}$/)],
  });

  readonly consent = new FormControl(!!this.state.consent(), { nonNullable: true });
  readonly showConsentError = signal(false);
  readonly submitting = signal(false);
  readonly notFound = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('error') === 'not-found');

  readonly status = toSignal(this.bvn.statusChanges, { initialValue: this.bvn.status });
  readonly canSubmit = computed(() => this.status() === 'VALID' && !this.submitting());

  constructor() {
    const saved = this.state.bvn();
    if (saved && !this.notFound()) this.bvn.setValue(saved.value);
  }

  onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digitsOnly = el.value.replace(/\D/g, '').slice(0, 11);
    if (digitsOnly !== el.value) el.value = digitsOnly;
    this.bvn.setValue(digitsOnly);
    this.notFound.set(false);
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.bvn.invalid) {
      this.bvn.markAsTouched();
      focusFirstInvalid();
      return;
    }
    if (!this.consent.value) {
      this.showConsentError.set(true);
      document.getElementById('consent')?.focus();
      return;
    }
    this.state.setConsent({
      version: PRIVACY_NOTICE_VERSION,
      acceptedAt: new Date().toISOString(),
      language: this.lang.lang(),
    });
    this.submitting.set(true);
    // Not verified yet: the next screen sends the code to the phone linked to this BVN.
    this.state.setBvn({ value: this.bvn.value, verified: false });
    void this.router.navigateByUrl('/apply/verify');
  }
}
