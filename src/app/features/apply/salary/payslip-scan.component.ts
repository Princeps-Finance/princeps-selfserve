import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { API_CLIENT } from '../../../core/api/api-client';
import type { PayslipFigures, PayslipResult } from '../../../core/api/payslip';
import { CaptchaService } from '../../../core/captcha/captcha.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { MAX_UPLOAD_BYTES } from '../../../core/limits';
import { logWarn } from '../../../core/log';

type Phase = 'idle' | 'reading' | 'review' | 'confirmed';
type Problem = 'unreadable' | 'too-large' | 'bad-type' | 'rate-limited' | 'service-down';

const ACCEPTED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

/**
 * Optional help on the salary screen: photograph a payslip and we read the figures off it. The customer always checks
 * them (and can correct them) before they are used, and the server still decides eligibility.
 */
@Component({
  selector: 'app-payslip-scan',
  imports: [ReactiveFormsModule, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="scan" [attr.aria-labelledby]="'payslip-title'">
      <h2 class="scan-title" id="payslip-title">{{ 'payslip.title' | t }}</h2>

      @switch (phase()) {
        @case ('reading') {
          <p class="scan-note" role="status">{{ 'payslip.reading' | t }}</p>
        }
        @case ('review') {
          <p class="scan-note">{{ 'payslip.check' | t }}</p>
          <div class="fields">
            <label class="label" for="payslip-net">{{ 'payslip.net' | t }}</label>
            <input id="payslip-net" class="input" type="text" inputmode="numeric" autocomplete="off" [formControl]="net" [attr.aria-invalid]="net.invalid && net.touched ? true : null" />
            @if (net.invalid && net.touched) {
              <p class="error" role="alert">{{ 'payslip.net.invalid' | t }}</p>
            }
            @if (details(); as d) {
              <p class="detail">{{ d }}</p>
            }
          </div>
          <div class="row">
            <button type="button" class="btn" (click)="confirm()">{{ 'payslip.confirm' | t }}</button>
            <button type="button" class="link" (click)="pick()">{{ 'payslip.again' | t }}</button>
          </div>
        }
        @case ('confirmed') {
          <p class="scan-note" role="status">{{ 'payslip.confirmed' | t }}</p>
          <button type="button" class="link" (click)="pick()">{{ 'payslip.again' | t }}</button>
        }
        @default {
          <p class="scan-note">{{ 'payslip.sub' | t }}</p>
          <button type="button" class="btn" (click)="pick()">{{ 'payslip.scan' | t }}</button>
        }
      }

      @if (problem(); as p) {
        <p class="error" role="alert">{{ problemKey(p) | t }}</p>
      }

      <input #file class="file" type="file" accept="image/*,application/pdf" capture="environment" tabindex="-1" aria-hidden="true" (change)="onFile($event)" />
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .scan { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); border: 1px dashed var(--input-border); border-radius: var(--radius-md, 12px); }
      .scan-title { margin: 0; font-size: var(--fs-lg); }
      .scan-note, .detail { margin: 0; color: var(--ink-soft); line-height: 1.5; }
      .fields { display: flex; flex-direction: column; gap: var(--space-2); }
      .row { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
      .btn { min-height: 48px; padding: 0 var(--space-5); border-radius: var(--radius-pill); border: 1.5px solid var(--ink); background: transparent; color: var(--ink); font: inherit; font-weight: 600; cursor: pointer; align-self: flex-start; }
      .btn:focus-visible, .link:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
      .link { min-height: 44px; padding: 0 var(--space-2); border: 0; background: none; color: var(--text-accent); font: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; align-self: flex-start; }
      .error { margin: 0; color: var(--danger-text); }
      .file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    `,
  ],
})
export class PayslipScanComponent {
  private readonly api = inject(API_CLIENT);
  private readonly captcha = inject(CaptchaService);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');

  /** Fires with the figures the customer confirmed, or with null when they scan again or clear them. */
  readonly figures = output<PayslipFigures | null>();

  protected readonly phase = signal<Phase>('idle');
  protected readonly problem = signal<Problem | null>(null);
  private readonly read = signal<PayslipFigures | null>(null);
  protected readonly net = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\s*₦?\s*[\d,]+\s*$/)] });

  /** What else was read, shown as a line the customer can check against the paper. */
  protected readonly details = computed(() => {
    const f = this.read();
    if (!f) return '';
    return [f.grossMonthly ? `Gross ₦${f.grossMonthly.toLocaleString('en-NG')}` : '', f.month ?? '', f.employer ?? ''].filter(Boolean).join(' · ');
  });

  protected pick(): void {
    this.problem.set(null);
    this.figures.emit(null);
    const el = this.fileInput().nativeElement;
    el.value = '';
    el.click();
  }

  protected async onFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) return this.fail('too-large');
    if (!ACCEPTED.test(file.type)) return this.fail('bad-type');
    this.problem.set(null);
    this.phase.set('reading');
    let res: PayslipResult;
    try {
      res = await this.api.extractPayslip(file, await this.captcha.token());
    } catch (err) {
      logWarn('payslip scan failed', err);
      res = { status: 'service-down' };
    }
    if (res.status !== 'ok') return this.fail(res.status);
    this.read.set(res.figures);
    this.net.setValue(res.figures.netMonthly.toLocaleString('en-NG'));
    this.net.markAsUntouched();
    this.phase.set('review');
    setTimeout(() => document.getElementById('payslip-net')?.focus());
  }

  protected confirm(): void {
    this.net.markAsTouched();
    const base = this.read();
    const amount = Number(this.net.value.replace(/[₦,\s]/g, ''));
    if (!base || this.net.invalid || !Number.isFinite(amount) || amount <= 0) return;
    this.phase.set('confirmed');
    // What the customer typed wins over what was read: a corrected net pay drops a gross that no longer fits.
    const keepGross = base.grossMonthly !== undefined && base.grossMonthly >= amount;
    this.figures.emit({ ...base, netMonthly: Math.round(amount), grossMonthly: keepGross ? base.grossMonthly : undefined });
  }

  protected problemKey(p: Problem): string {
    return p === 'unreadable' ? 'payslip.error.unreadable'
      : p === 'too-large' ? 'payslip.error.size'
      : p === 'bad-type' ? 'payslip.error.type'
      : p === 'rate-limited' ? 'payslip.error.limited'
      : 'payslip.error.service';
  }

  private fail(p: Problem): void {
    this.phase.set('idle');
    this.problem.set(p);
  }
}
