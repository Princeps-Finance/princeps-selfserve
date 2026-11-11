import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { CheckboxComponent } from '../../../shared/checkbox.component';
import { OfferLetterComponent } from '../terms/offer-letter.component';

/**
 * The offer letter, shown in the page right before the repayment set-up. It has to be read to the end before the
 * customer can accept it, and accepting it is what records their agreement to the terms.
 */
@Component({
  selector: 'app-offer-letter-step',
  imports: [TPipe, CheckboxComponent, OfferLetterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="step">
      <header class="head">
        <h1 class="title">{{ 'step.offerletter.title' | t }}</h1>
        <p class="subtitle">{{ 'step.offerletter.subtitle' | t }}</p>
      </header>

      <app-offer-letter [request]="letterRequest()" (readToEnd)="letterRead.set(true)" />

      <label class="agree" [class.is-locked]="!letterRead()">
        <app-checkbox [invalid]="attempted() && !agreed()" describedBy="agree-error" [disabled]="!letterRead()" [checked]="agreed()" (checkedChange)="toggleAgree($event)" />
        <span>{{ 'step.terms.agree' | t }}</span>
      </label>
      @if (attempted() && !agreed()) {
        <p class="msg--error" id="agree-error" role="alert">{{ 'form.agree.required' | t }}</p>
      }

      <button type="button" class="cta" (click)="accept()">
        <span>{{ 'step.offerletter.accept' | t }}</span>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </section>
  `,
  styles: [
    `
      .step { gap: var(--space-5); }
      .head { display: flex; flex-direction: column; gap: var(--space-2); }
      .subtitle { margin: 0; color: var(--ink-soft); line-height: 1.5; }
      .agree { display: flex; align-items: flex-start; gap: 10px; font-size: var(--fs-md); color: var(--ink); cursor: pointer; }
      .agree.is-locked { opacity: 0.6; cursor: not-allowed; }
      .msg--error { margin: 0; color: var(--danger-text); font-size: var(--fs-sm); }
      .cta { margin-top: auto; }
    `,
  ],
})
export class OfferLetterStepComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  readonly agreed = signal(false);
  readonly attempted = signal(false);
  /** Set when the letter has been scrolled to the end. The agreement box stays locked until then. */
  readonly letterRead = signal(false);

  /** What the offer letter is generated for. */
  readonly letterRequest = computed(() => {
    const o = this.state.offer();
    return {
      productId: o?.productId ?? '',
      productName: o?.productName ?? '',
      amount: o?.amount ?? 0,
      tenorMonths: o?.tenorMonths ?? 0,
      monthlyRepayment: o?.monthlyRepayment ?? 0,
      ratePercent: o?.ratePercent ?? 0,
    };
  });

  toggleAgree(v: boolean): void {
    if (v && !this.letterRead()) return;
    this.agreed.set(v);
    if (v) this.attempted.set(false);
  }

  accept(): void {
    if (!this.agreed()) {
      this.attempted.set(true);
      document.querySelector<HTMLElement>('.agree input')?.focus();
      return;
    }
    this.state.setTermsAccepted(new Date().toISOString());
    void this.flow.go(APPLY.mandate);
  }
}
