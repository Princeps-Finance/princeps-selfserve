import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApplicationStore } from '../state/application.store';
import { ApplicationApi } from '../data-access/application.api';
import { OtpInput } from '@princeps-finance/ui';
import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { InputDirective } from '../../../shared/components/input/input.directive';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { AnimatedIconComponent } from '../../../shared/components/animated-icon.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { WhyAskComponent } from '../../../shared/components/why-ask.component';
import { IllustrationComponent } from '../../../shared/components/illustration.component';
import { WizardProgressComponent } from '../wizard-progress.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { PRIVACY_NOTICE_VERSION, PrivacyService } from '../../privacy/privacy.service';
import type { ContactUnreachableResponseDto } from '../data-access/application-contract';

function normalizePhone(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

@Component({
  selector: 'app-verification',
  imports: [
    SpinnerComponent,
    ReactiveFormsModule,
    OtpInput,
    ButtonDirective,
    InputDirective,
    DialogComponent,
    IllustrationComponent,
    WizardProgressComponent,
    WhyAskComponent,
    AnimatedIconComponent,
    IconComponent,
    TPipe,
  ],
  templateUrl: './verification.component.html',
  styleUrl: './verification.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationComponent {
  protected readonly store = inject(ApplicationStore);
  private readonly api = inject(ApplicationApi);
  protected readonly privacy = inject(PrivacyService);
  protected readonly isBvn = inject(ActivatedRoute).snapshot.data['page'] === 'bvn';
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  protected readonly startForm = new FormGroup({
    bvn: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{11}$/)],
    }),
    consent: new FormControl(false, { nonNullable: true, validators: Validators.requiredTrue }),
  });
  protected readonly otpForm = new FormGroup({
    otp: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
  });
  protected readonly alternateForm = new FormGroup({
    phoneNumber: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        (control) =>
          /^(?:0[789]\d{9}|\+234[789]\d{9})$/.test(normalizePhone(control.value))
            ? null
            : { phone: true },
      ],
    }),
  });
  protected readonly canPaste =
    typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function';
  protected readonly pickerOpen = signal(false);
  protected readonly enteringAlternate = signal(false);
  protected readonly attempted = signal(false);
  protected readonly support = signal<ContactUnreachableResponseDto['support'] | null>(null);
  protected readonly contacts = computed(() => this.store.application()?.contacts ?? []);
  protected readonly expiredSession = computed(() =>
    ['send', 'verify'].some((key) => this.store.errors()[key]?.code === 'BVN_SESSION_EXPIRED'),
  );
  private readonly now = signal(Date.now());
  protected readonly seconds = computed(() =>
    Math.max(0, Math.ceil((this.store.resendAt() - this.now()) / 1000)),
  );
  protected readonly selected = computed(() => this.store.otpDelivery()?.contactId ?? '');
  protected readonly selectedContact = computed(() =>
    this.contacts().find((contact) => contact.id === this.selected()),
  );
  protected readonly target = computed(() => this.selectedContact()?.masked ?? '');

  constructor() {
    if (!this.isBvn) {
      const timer = setInterval(() => this.now.set(Date.now()), 1000);
      this.destroy.onDestroy(() => clearInterval(timer));
    }
  }

  protected async start() {
    this.attempted.set(true);
    this.startForm.markAllAsTouched();
    if (this.startForm.invalid || this.store.pending()['start']) return;
    this.store.reset();
    this.support.set(null);
    if (
      await this.store.start({
        ...this.startForm.getRawValue(),
        noticeVersion: PRIVACY_NOTICE_VERSION,
      })
    ) {
      if (this.destroy.destroyed) return;
      this.attempted.set(false);
      this.startForm.controls.bvn.reset();
      this.pickerOpen.set(true);
    }
  }

  protected closePicker() {
    this.pickerOpen.set(false);
    this.enteringAlternate.set(false);
    this.alternateForm.reset();
    this.support.set(null);
  }

  protected async send(contactId: string, phoneNumber?: string) {
    if (this.expiredSession()) return;
    const sent = await this.store.sendCode({ contactId, phoneNumber });
    if (!sent || this.destroy.destroyed) return;
    this.otpForm.reset();
    this.now.set(Date.now());
    if (this.isBvn) {
      this.closePicker();
      await this.router.navigateByUrl('/apply/verify');
    }
  }

  protected sendAlternate() {
    this.alternateForm.markAllAsTouched();
    if (this.alternateForm.invalid) return;
    void this.send(
      'mono-alternate_phone',
      normalizePhone(this.alternateForm.controls.phoneNumber.value),
    );
  }

  protected resend() {
    const delivery = this.store.otpDelivery();
    if (delivery) void this.send(delivery.contactId, delivery.phoneNumber);
  }

  protected async pasteCode() {
    try {
      const digits = (await navigator.clipboard.readText()).replace(/\D/g, '').slice(0, 6);
      if (this.destroy.destroyed || !digits || this.store.pending()['verify']) return;
      this.otpForm.controls.otp.setValue(digits);
      this.store.clearError('verify');
    } catch {
      // The customer can type directly into the OTP field if clipboard access is denied.
    }
  }

  protected async verify() {
    this.otpForm.markAllAsTouched();
    if (this.otpForm.invalid || this.expiredSession() || this.store.pending()['send']) return;
    if ((await this.store.verify(this.otpForm.controls.otp.value)) && !this.destroy.destroyed) {
      this.otpForm.reset();
      await this.router.navigateByUrl(this.store.nextRoute());
    }
  }

  protected restartVerification() {
    this.otpForm.reset();
    this.closePicker();
    this.store.reset();
    void this.router.navigateByUrl('/apply/bvn', { replaceUrl: true });
  }

  protected async unreachable() {
    const result = await this.store.run('support', () => this.api.getUnreachableContactSupport());
    if (result && !this.destroy.destroyed && this.pickerOpen()) this.support.set(result.support);
  }

  protected async wrongBvn() {
    if ((await this.store.run('close', () => this.api.resetIdentity())) && !this.destroy.destroyed)
      this.restartVerification();
  }

  protected whatsapp(number: string) {
    return 'https://wa.me/' + number.replace(/\D/g, '');
  }
}
