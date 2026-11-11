import { AnimatedIconComponent } from '../../../shared/animated-icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { ModalComponent } from '../../../shared/modal.component';
import { QuoteService } from '../../../core/pricing/quote.service';
import { formatNaira } from '../../../core/money.util';
import { CheckboxComponent } from '../../../shared/checkbox.component';
import { OfferLetterComponent } from '../terms/offer-letter.component';

/**
 * The offer letter, shown in the page right before the repayment set-up. It has to be read to the end before the
 * customer can accept it, and accepting it is what records their agreement to the terms.
 */
@Component({
  selector: 'app-offer-letter-step',
  imports: [AnimatedIconComponent, ModalComponent, TPipe, CheckboxComponent, OfferLetterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="step">
      <header class="head">
        <h1 class="title">{{ 'step.offerletter.title' | t }}</h1>
        <p class="subtitle">{{ 'step.offerletter.subtitle' | t }}</p>
      </header>

      @if (state.offer(); as o) {
        <dl class="facts">
          <div><dt>{{ 'step.terms.principal' | t }}</dt><dd>{{ naira(o.amount) }}</dd></div>
          <div><dt>{{ 'step.terms.tenor' | t }}</dt><dd>{{ o.tenorMonths }} {{ 'step.offers.months' | t }}</dd></div>
          <div><dt>{{ 'step.terms.monthly' | t }}</dt><dd>{{ naira(o.monthlyRepayment) }}</dd></div>
        </dl>
      }

      <button type="button" class="cta" (click)="letterOpen.set(true)">
        <span>{{ 'step.offerletter.read' | t }}</span>
        <app-animated-icon animation="arrow-right" fallback="outline-arrow-right" [size]="18" />
      </button>

      <!-- The letter, the agreement and the accept button live in the window: the box unlocks once the letter is read to the end. -->
      <app-modal [open]="letterOpen()" [title]="'pdf.letter.title' | t" (closed)="letterOpen.set(false)">
        @if (letterOpen()) {
          <app-offer-letter [request]="letterRequest()" (readToEnd)="letterRead.set(true)" />
          <label class="agree" [class.is-locked]="!letterRead()">
            <app-checkbox [invalid]="attempted() && !agreed()" describedBy="agree-error" [disabled]="!letterRead()" [checked]="agreed()" (checkedChange)="toggleAgree($event)" />
            <span>{{ 'step.terms.agree' | t }}</span>
          </label>
          @if (!letterRead()) {
            <p class="note">{{ 'step.offerletter.readfirst' | t }}</p>
          }
          @if (attempted() && !agreed()) {
            <p class="msg--error" id="agree-error" role="alert">{{ 'form.agree.required' | t }}</p>
          }
          <button type="button" class="cta accept" [disabled]="!agreed()" (click)="accept()">
            <span>{{ 'step.offerletter.accept' | t }}</span>
            <app-animated-icon animation="arrow-right" fallback="outline-arrow-right" [size]="18" />
          </button>
        }
      </app-modal>
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
      .facts { margin: 0; display: flex; flex-direction: column; border-top: 1px solid var(--hairline); }
      .facts > div { display: flex; justify-content: space-between; gap: var(--space-4); padding: var(--space-4) 0; border-bottom: 1px solid var(--hairline); }
      .facts dt { color: var(--ink-soft); }
      .facts dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
      .accept { margin-top: var(--space-3); }
      .note { margin: var(--space-2) 0 0; font-size: var(--fs-sm); color: var(--ink-muted); }
    `,
  ],
})
export class OfferLetterStepComponent {
  protected readonly state = inject(ApplicationStateService);
  private readonly quotes = inject(QuoteService);
  protected readonly naira = formatNaira;
  readonly letterOpen = signal(false);
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
      quoteId: o?.quote?.quoteId,
    };
  });

  toggleAgree(v: boolean): void {
    if (v && !this.letterRead()) return;
    this.agreed.set(v);
    if (v) this.attempted.set(false);
  }

  async accept(): Promise<void> {
    if (!this.agreed()) {
      this.attempted.set(true);
      document.querySelector<HTMLElement>('.agree input')?.focus();
      return;
    }
    // The letter was written from the quote; make sure that quote is still good before it is accepted.
    if (!(await this.quotes.confirm())) return;
    this.state.setTermsAccepted(new Date().toISOString());
    void this.flow.next(APPLY.offerLetter);
  }
}
