import { IconComponent } from '../../../shared/icon.component';
import { WhyAskComponent } from '../../../shared/why-ask.component';
import { CheckboxComponent } from '../../../shared/checkbox.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IllustrationComponent } from '../../../core/ui/illustration.component';
import { ActivatedRoute } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { whatsappLink } from '../../../core/support';
import { LangService } from '../../../core/i18n/lang.service';
import { PRIVACY_NOTICE_VERSION, PrivacyService } from '../../../core/privacy/privacy.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { API_CLIENT, MaskedContact, OtpDestination } from '../../../core/api/api-client';
import { CaptchaService } from '../../../core/captcha/captcha.service';
import { OtpChannelDialogComponent } from './otp-channel-dialog.component';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

/**
 * The BVN is asked first. We then text a code to the phone linked to that BVN, so only its real
 * owner can continue, and the owner's details fill the form for them.
 */
@Component({
  selector: 'app-bvn',
  imports: [IconComponent, WhyAskComponent, CheckboxComponent, IllustrationComponent, TPipe, WizardProgressComponent, ReactiveFormsModule, OtpChannelDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bvn.component.html',
  styleUrl: './bvn.component.css',
})
export class BvnComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly lang = inject(LangService);
  private readonly api = inject(API_CLIENT);
  private readonly captcha = inject(CaptchaService);
  protected readonly privacy = inject(PrivacyService);
  readonly support = whatsappLink('Hello Princeps, I need help with my BVN.');

  readonly bvn = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{11}$/)],
  });

  readonly consent = new FormControl(!!this.state.consent(), { nonNullable: true });
  readonly showConsentError = signal(false);
  readonly submitting = signal(false);
  /** The contacts tied to this BVN, set while the "where should we send your code" dialog is open. */
  readonly contacts = signal<{ phones: MaskedContact[]; emails: MaskedContact[] } | null>(null);
  readonly lookupFailed = signal(false);
  readonly notFound = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('error') === 'not-found');

  readonly status = toSignal(this.bvn.statusChanges, { initialValue: this.bvn.status });
  readonly canSubmit = computed(() => this.status() === 'VALID' && !this.submitting());

  constructor() {
    // Only a BVN typed a moment ago and not yet verified comes back (the customer went back from the code screen to fix
    // it). A verified one, from an earlier visit, is never shown again: another person may be using this phone.
    const saved = this.state.bvn();
    if (saved && !saved.verified && !this.notFound()) this.bvn.setValue(saved.value);
  }

  onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digitsOnly = el.value.replace(/\D/g, '').slice(0, 11);
    if (digitsOnly !== el.value) el.value = digitsOnly;
    this.bvn.setValue(digitsOnly);
    this.notFound.set(false);
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    if (this.bvn.invalid) {
      this.bvn.markAsTouched();
      focusFirstInvalid();
      return;
    }
    if (!this.consent.value) {
      this.showConsentError.set(true);
      document.querySelector<HTMLElement>('#consent input')?.focus();
      return;
    }
    this.state.setConsent({
      version: PRIVACY_NOTICE_VERSION,
      acceptedAt: new Date().toISOString(),
      language: this.lang.lang(),
    });
    this.submitting.set(true);
    this.lookupFailed.set(false);
    // Show where the code can go (the contacts tied to this BVN, masked) before anything is sent.
    const found = await this.api.lookupBvnContacts(this.bvn.value, await this.captcha.token());
    if (found.status === 'ok') {
      this.contacts.set({ phones: found.phones, emails: found.emails });
      return; // the dialog now owns the next step; the button stays busy until it is answered
    }
    this.submitting.set(false);
    if (found.status === 'not-found') this.notFound.set(true);
    else this.lookupFailed.set(true);
  }

  /** The customer chose where the code goes. Not verified yet: the next screen sends it. */
  onDestination(destination: OtpDestination): void {
    this.state.setBvn({ value: this.bvn.value, verified: false });
    this.state.setOtpDestination(destination);
    this.contacts.set(null);
    void this.flow.go(APPLY.verify);
  }

  onDialogCancelled(): void {
    this.contacts.set(null);
    this.submitting.set(false);
  }
}
