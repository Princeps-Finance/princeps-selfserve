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
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../../core/i18n/t.pipe';
import { LangService } from '../../../core/i18n/lang.service';
import { WizardProgressComponent } from '../wizard-progress.component';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

type OtpError =
  | { kind: 'wrong' }
  | { kind: 'expired' }
  | { kind: 'locked'; retryAfterSeconds: number };

@Component({
  selector: 'app-verify-phone',
  imports: [TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verify-phone.component.html',
  styleUrl: './verify-phone.component.css',
})
export class VerifyPhoneComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);

  readonly length = OTP_LENGTH;
  readonly indices = Array.from({ length: OTP_LENGTH }, (_, i) => i);
  readonly cells = signal<string[]>(Array(OTP_LENGTH).fill(''));
  readonly cellRefs = viewChildren<ElementRef<HTMLInputElement>>('cell');

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
    const contact = this.state.contact();
    if (!contact) {
      await this.router.navigateByUrl('/apply/contact');
      return;
    }
    const res = await this.api.sendPhoneOtp(contact.phone);
    this.maskedTarget.set(res.target);
    this.startCooldown();
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.cellRefs()[0]?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  }

  onCellInput(i: number, evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');

    if (digits.length > 1) {
      // Handle paste / autofill: distribute across cells.
      this.setCode(digits);
      return;
    }

    const next = [...this.cells()];
    next[i] = digits;
    this.cells.set(next);
    input.value = digits;

    this.error.set(null);
    if (digits && i < OTP_LENGTH - 1) this.cellRefs()[i + 1]?.nativeElement.focus();
    if (this.code().length === OTP_LENGTH) void this.submit();
  }

  onCellKeydown(i: number, evt: KeyboardEvent): void {
    if (evt.key === 'Backspace' && !this.cells()[i] && i > 0) {
      this.cellRefs()[i - 1]?.nativeElement.focus();
      return;
    }
    if (evt.key === 'ArrowLeft' && i > 0) this.cellRefs()[i - 1]?.nativeElement.focus();
    if (evt.key === 'ArrowRight' && i < OTP_LENGTH - 1) this.cellRefs()[i + 1]?.nativeElement.focus();
  }

  onCellPaste(evt: ClipboardEvent): void {
    const pasted = (evt.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (!pasted) return;
    evt.preventDefault();
    this.setCode(pasted);
  }

  private setCode(raw: string): void {
    const digits = raw.slice(0, OTP_LENGTH).split('');
    const next = Array(OTP_LENGTH).fill('') as string[];
    digits.forEach((d, i) => (next[i] = d));
    this.cells.set(next);
    const refs = this.cellRefs();
    refs.forEach((r, i) => (r.nativeElement.value = next[i]));
    const focusIdx = Math.min(digits.length, OTP_LENGTH - 1);
    refs[focusIdx]?.nativeElement.focus();
    if (this.code().length === OTP_LENGTH) void this.submit();
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    if (this.code().length !== OTP_LENGTH) {
      this.attempted.set(true);
      const empty = this.cells().findIndex((c) => !c);
      this.cellRefs()[empty === -1 ? 0 : empty]?.nativeElement.focus();
      return;
    }
    const contact = this.state.contact();
    if (!contact) return;

    this.submitting.set(true);
    this.error.set(null);
    try {
      const res = await this.api.verifyPhoneOtp(contact.phone, this.code());
      if (res.status === 'ok') {
        this.state.markPhoneVerified();
        const next = this.state.isReturningCustomer() ? '/apply/welcome-back' : '/apply/employment';
        await this.router.navigateByUrl(next);
        return;
      }
      if (res.status === 'wrong') this.error.set({ kind: 'wrong' });
      else if (res.status === 'expired') this.error.set({ kind: 'expired' });
      else this.error.set({ kind: 'locked', retryAfterSeconds: res.retryAfterSeconds });
      this.cells.set(Array(OTP_LENGTH).fill(''));
      this.cellRefs().forEach((r) => (r.nativeElement.value = ''));
      this.cellRefs()[0]?.nativeElement.focus();
    } finally {
      this.submitting.set(false);
    }
  }

  async resend(): Promise<void> {
    if (this.resendCooldown() > 0 || this.resending()) return;
    const contact = this.state.contact();
    if (!contact) return;
    this.resending.set(true);
    this.justResent.set(false);
    try {
      const res = await this.api.sendPhoneOtp(contact.phone);
      this.maskedTarget.set(res.target);
      this.justResent.set(true);
      this.error.set(null);
      this.startCooldown();
    } finally {
      this.resending.set(false);
    }
  }

  goBack(): void {
    void this.router.navigateByUrl('/apply/contact');
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
    return 'step.otp.error.locked';
  }

  errorParams(): Record<string, string | number> | undefined {
    const e = this.error();
    if (e?.kind === 'locked') return { seconds: e.retryAfterSeconds };
    return undefined;
  }
}
