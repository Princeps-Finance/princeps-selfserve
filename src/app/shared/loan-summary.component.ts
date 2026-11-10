import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TPipe } from '../core/i18n/t.pipe';
import { formatNaira } from '../core/money.util';
import { ApplicationStateService } from '../core/application/application-state.service';
import { APPLY } from '../core/flow/apply-routes';
import { FlowNavigator } from '../core/flow/flow-navigator.service';
import { productById } from '../core/products/products';
import { ModalComponent } from './modal.component';
import { ProductMarkComponent } from './product-mark.component';

/**
 * One line at the top of the later steps: the loan the customer chose (amount and period). Tapping it opens the
 * details in a sheet (a bottom sheet on a phone, a centred window on a wide screen), so the figures are always one
 * tap away without taking up the page.
 */
@Component({
  selector: 'app-loan-summary',
  imports: [TPipe, ModalComponent, ProductMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (offer(); as o) {
      <button type="button" class="bar" (click)="open.set(true)" aria-haspopup="dialog" [attr.aria-label]="('summary.open' | t) + ': ' + money(o.amount) + ', ' + o.tenorMonths + ' ' + ('step.offers.months' | t)">
        <span class="bar-text">
          <span class="bar-label">{{ 'summary.title' | t }}</span>
          <span class="bar-main">{{ money(o.amount) }} · {{ o.tenorMonths }} {{ 'step.offers.months' | t }}</span>
        </span>
        <svg class="chev" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <app-modal [open]="open()" [title]="'summary.title' | t" (closed)="open.set(false)">
        <div class="head">
          @if (product(); as p) { <app-product-mark [product]="p" /> }
          <h2 class="name">{{ o.productName }}</h2>
        </div>
        <dl class="rows">
          <div class="row"><dt>{{ 'step.terms.principal' | t }}</dt><dd>{{ money(o.amount) }}</dd></div>
          <div class="row"><dt>{{ 'step.terms.tenor' | t }}</dt><dd>{{ o.tenorMonths }} {{ 'step.offers.months' | t }}</dd></div>
          <div class="row"><dt>{{ 'step.offers.monthly' | t }}</dt><dd>{{ money(o.monthlyRepayment) }}</dd></div>
          <div class="row"><dt>{{ 'step.terms.rate' | t }}</dt><dd>{{ o.ratePercent }}%</dd></div>
          @if (fees() > 0) {
            <div class="row"><dt>{{ 'step.terms.fees' | t }}</dt><dd>{{ money(fees()) }}</dd></div>
          }
          <div class="row row--strong"><dt>{{ 'step.terms.total' | t }}</dt><dd>{{ money(o.monthlyRepayment * o.tenorMonths) }}</dd></div>
        </dl>
        <button type="button" class="alt change" (click)="change()">{{ 'summary.change' | t }}</button>
        <p class="note">{{ 'summary.change.hint' | t }}</p>
      </app-modal>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .bar {
        width: 100%; min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
        padding: var(--space-2) var(--space-4); border: 0; border-radius: var(--radius-md);
        background: var(--grey-100); color: var(--ink); font: inherit; text-align: left; cursor: pointer;
        transition: transform 120ms ease-out, background 160ms ease;
      }
      .bar:active { transform: scale(0.99); }
      .bar:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
      @media (hover: hover) and (pointer: fine) { .bar:hover { background: var(--grey-200); } }
      .bar-text { display: flex; flex-direction: column; min-width: 0; }
      .bar-label { font-size: var(--fs-xs); color: var(--ink-soft); }
      .bar-main { font-weight: 600; font-variant-numeric: tabular-nums; }
      .chev { flex: none; color: var(--ink-soft); }
      .head { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
      .name { margin: 0; font-family: var(--font-display); font-size: var(--fs-lg); }
      .rows { margin: 0 0 var(--space-4); display: flex; flex-direction: column; }
      .row { display: flex; justify-content: space-between; gap: var(--space-4); padding: var(--space-3) 0; border-bottom: 1px solid var(--hairline); }
      .row:last-child { border-bottom: 0; }
      .row dt { margin: 0; color: var(--ink-soft); }
      .row dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
      .row--strong dd { font-weight: 700; }
      .change { display: flex; width: 100%; }
      .note { margin: var(--space-2) 0 0; font-size: var(--fs-sm); color: var(--ink-soft); text-align: center; }
    `,
  ],
})
export class LoanSummaryComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  protected readonly money = formatNaira;
  protected readonly open = signal(false);
  protected readonly offer = this.state.offer;
  protected readonly product = computed(() => productById(this.offer()?.productId ?? ''));
  protected readonly fees = computed(() => (this.offer()?.fees ?? []).reduce((sum, f) => sum + f.amount, 0));

  /** Back to the amount and period. The steps after this one are repeated, because they depend on the figures. */
  protected change(): void {
    this.open.set(false);
    void this.flow.go(APPLY.offers);
  }
}
