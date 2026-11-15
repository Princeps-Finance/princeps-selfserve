import { AnimatedIconComponent } from '../../../shared/animated-icon.component';
import { logWarn } from '../../../core/log';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { IllustrationComponent } from '../../../core/ui/illustration.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { LangService } from '../../../core/i18n/lang.service';
import { WizardProgressComponent } from '../wizard-progress.component';
import { environment } from '../../../../environments/environment';
import { API_CLIENT } from '../../../core/api/api-client';
import { normalizePhoneNg } from '../../../core/api/contact.util';
import { CaptchaService } from '../../../core/captcha/captcha.service';
import { ReturningService } from '../../../core/application/returning.service';
import { HapticsService } from '../../../core/ui/haptics.service';
import { DraftService } from '../../../core/application/draft.service';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

type OtpError =
  | { kind: 'wrong' }
  | { kind: 'expired' }
  | { kind: 'locked'; retryAfterSeconds: number }
  | { kind: 'service' };

@Component({
  selector: 'app-verify-phone',
  imports: [AnimatedIconComponent, IllustrationComponent, TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verify-phone.component.html',
  styleUrl: './verify-phone.component.css',
})
export class VerifyPhoneComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly demo = environment.demoBanner;
  private readonly api = inject(API_CLIENT);
  private readonly captcha = inject(CaptchaService);
  private readonly drafts = inject(DraftService);
  private readonly returning = inject(ReturningService);
  private readonly haptics = inject(HapticsService);
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly lang = inject(LangService);

  readonly length = OTP_LENGTH;
  readonly indices = Array.from({ length: OTP_LENGTH }, (_, i) => i);
  readonly cells = signal<string[]>(Array(OTP_LENGTH).fill(''));
  readonly field = viewChild<ElementRef<HTMLInputElement>>('otpField');
  readonly focused = signal(false);
  /** The box the next digit goes into. */
  readonly activeIndex = computed(() => Math.min(this.code().length, OTP_LENGTH - 1));

  readonly maskedTarget = signal<string>('');
  readonly submitting = signal(false);
  readonly resending = signal(false);
  readonly error = signal<OtpError | null>(null);
  readonly resendCooldown = signal(0);
  readonly justResent = signal(false);

  readonly currentLang = computed(() => this.lang.lang());
  readonly attempted = signal(false);
  readonly code = computed(() => this.cells().join(''));
  readonly canSubmit = computed(() => this.code().length === OTP_LENGTH && !this.submitting());

  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    const bvn = this.state.bvn();
    const ref = this.state.returningRef();
    if (!bvn && !ref) {
      await this.flow.go(APPLY.bvn);
      return;
    }
    try {
      // The code goes to the phone linked to the BVN, not to the number typed earlier. A returning customer has
      // no BVN typed: the handle kept on this device stands in for it.
      const res = bvn
        ? await this.api.sendBvnOtp(bvn.value, await this.captcha.token(), this.state.otpDestination() ?? undefined)
        : await this.api.sendReturningOtp(ref as string, await this.captcha.token());
      if (res.status === 'not-found') {
        await this.flow.go(APPLY.bvn, { queryParams: { error: 'not-found' } });
        return;
      }
      this.maskedTarget.set(res.target);
      this.startCooldown();
      this.listenForSms();
    } catch (err) {
        logWarn('verify-phone step 1 failed', err);
this.error.set({ kind: 'service' });
    }
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.field()?.nativeElement.focus());
  }

  private smsAbort: AbortController | null = null;

  /** Android Chrome can read the code from the text message itself (when it ends with the site and code), so nothing is typed. */
  private listenForSms(): void {
    if (typeof window === 'undefined' || !('OTPCredential' in window) || !navigator.credentials) return;
    this.smsAbort?.abort();
    this.smsAbort = new AbortController();
    const options = { otp: { transport: ['sms'] }, signal: this.smsAbort.signal } as unknown as CredentialRequestOptions;
    navigator.credentials
      .get(options)
      .then((c) => {
        const code = (c as { code?: string } | null)?.code;
        if (code && /^\d+$/.test(code)) this.setCode(code);
      })
      .catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.smsAbort?.abort();
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  }

  /**
   * One real input holds the whole code and the six boxes only show it. A single field is what lets the keyboard offer the
   * code from the text message (iPhone, Samsung, Huawei and others) and fill all six digits in one go; separate one-digit
   * fields cannot take it.
   */
  onCodeInput(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    this.setCode(input.value);
  }

  /** The "Paste code" button, for phones whose keyboard does not offer the code: reads what was copied from the text message. */
  readonly canPaste = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function';

  async pasteCode(): Promise<void> {
    try {
      this.setCode(await navigator.clipboard.readText());
    } catch {
      /* permission refused or nothing copied: the customer can still type it */
    }
  }

  private setCode(raw: string): void {
    const digits = raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill('') as string[];
    digits.split('').forEach((d, i) => (next[i] = d));
    this.cells.set(next);
    const field = this.field()?.nativeElement;
    if (field && field.value !== digits) field.value = digits;
    this.error.set(null);
    if (digits.length === OTP_LENGTH) void this.submit();
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    if (this.code().length !== OTP_LENGTH) {
      this.attempted.set(true);
      this.field()?.nativeElement.focus();
      return;
    }
    const bvn = this.state.bvn();
    const ref = this.state.returningRef();
    if (!bvn && !ref) return;

    this.submitting.set(true);
    this.error.set(null);
    try {
      const res = bvn ? await this.api.verifyBvnOtp(bvn.value, this.code()) : await this.api.verifyReturningOtp(ref as string, this.code());
      if (res.status === 'ok') {
        // A returning customer's BVN comes back with the verified code and lives in memory for this visit only.
        const verifiedBvn: string = bvn ? bvn.value : ((res as { bvn?: string }).bvn ?? '');
        if (!bvn) this.state.setBvn({ value: verifiedBvn, verified: false });
        if (res.customerRef) {
          this.returning.save({ ref: res.customerRef, firstName: res.identity.firstName || res.identity.fullName.split(' ')[0], maskedPhone: this.maskedTarget() });
        }
        // The contact number is the one registered with the BVN. Email is optional and asked later.
        const phone = normalizePhoneNg(res.identity.phone);
        if (!phone) throw new Error('BVN record has no usable phone number');
        const contact = { phone, email: this.state.contact()?.email ?? '' };
        this.state.setContact(contact);
        this.state.setBvnIdentity(res.identity);
        this.state.setBvn({ value: verifiedBvn, verified: true });
        this.state.markPhoneVerified();
        this.haptics.success();
        await this.flow.go(await this.nextAfterVerified(contact));
        return;
      }
      this.haptics.error();
      if (res.status === 'wrong') this.error.set({ kind: 'wrong' });
      else if (res.status === 'expired') this.error.set({ kind: 'expired' });
      else this.error.set({ kind: 'locked', retryAfterSeconds: res.retryAfterSeconds });
      this.cells.set(Array(OTP_LENGTH).fill(''));
      const field = this.field()?.nativeElement;
      if (field) {
        field.value = '';
        field.focus();
      }
    } catch (err) {
        logWarn('verify-phone step 2 failed', err);
this.error.set({ kind: 'service' });
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Only now, with a verified phone, do we look the customer up. A saved application on this
   * device comes first; otherwise a returning customer sees their summary; otherwise bio data.
   */
  private async nextAfterVerified(contact: { phone: string; email: string }): Promise<string> {
    const draft = this.drafts.find(contact.phone);
    if (draft) return APPLY.resume;
    try {
      const result = await this.api.lookupContact(contact);
      if (result.kind === 'returning') {
        this.state.setReturningCustomer(true, result.snapshot);
        return APPLY.loans;
      }
    } catch (err) {
        logWarn('verify-phone step 3 failed', err);
// A failed lookup must never block a new application.
    }
    this.state.setReturningCustomer(false, null);
    return APPLY.profile;
  }

  async resend(): Promise<void> {
    if (this.resendCooldown() > 0 || this.resending()) return;
    const bvn = this.state.bvn();
    const ref = this.state.returningRef();
    if (!bvn && !ref) return;
    this.resending.set(true);
    this.justResent.set(false);
    try {
      const res = bvn
        ? await this.api.sendBvnOtp(bvn.value, await this.captcha.token(), this.state.otpDestination() ?? undefined)
        : await this.api.sendReturningOtp(ref as string, await this.captcha.token());
      if (res.status !== 'sent') throw new Error('not-sent');
      this.maskedTarget.set(res.target);
      this.justResent.set(true);
      this.error.set(null);
      this.startCooldown();
    } catch (err) {
        logWarn('verify-phone step 4 failed', err);
this.error.set({ kind: 'service' });
    } finally {
      this.resending.set(false);
    }
  }

  goBack(): void {
    this.state.setReturningRef(null);
    void this.flow.go(this.returning.saved() ? APPLY.welcome : APPLY.bvn);
  }

  private startCooldown(): void {
    this.resendCooldown.set(RESEND_COOLDOWN_SECONDS);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      const next = this.resendCooldown() - 1;
      if (next <= 0) {
        this.resendCooldown.set(0);
        if (this.cooldownTimer) clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      } else {
        this.resendCooldown.set(next);
      }
    }, 1000);
  }

  errorKey(): string | null {
    const e = this.error();
    if (!e) return null;
    if (e.kind === 'wrong') return 'step.otp.error.wrong';
    if (e.kind === 'expired') return 'step.otp.error.expired';
    if (e.kind === 'service') return 'step.contact.error.generic';
    return 'step.otp.error.locked';
  }

  errorParams(): Record<string, string | number> | undefined {
    const e = this.error();
    if (e?.kind === 'locked') return { seconds: e.retryAfterSeconds };
    return undefined;
  }
}
