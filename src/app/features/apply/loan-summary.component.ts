import { Router } from '@angular/router';
import { ButtonDirective } from '../../shared/components/button/button.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TPipe } from '../../core/i18n/t.pipe';
import { formatNaira } from './money';
import { ApplicationStore } from './state/application.store';
import { APPLY } from './apply-routes';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';

/**
 * One line at the top of the later steps: the loan the customer chose (amount and period). Tapping it opens the
 * details in a sheet (a bottom sheet on a phone, a centred window on a wide screen), so the figures are always one
 * tap away without taking up the page.
 */
@Component({
  selector: 'app-loan-summary',
  imports: [ButtonDirective, IconComponent, TPipe, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (offer(); as selectedOffer) {
      <button type="button" class="bar" (click)="open.set(true)" aria-haspopup="dialog" [attr.aria-label]="('summary.open' | t) + ': ' + money(selectedOffer.amount) + ', ' + selectedOffer.tenorMonths + ' ' + ('step.offers.months' | t)">
        <span class="bar-text">
          <span class="bar-label">{{ 'summary.title' | t }}</span>
          <span class="bar-main">{{ money(selectedOffer.amount) }} · {{ selectedOffer.tenorMonths }} {{ 'step.offers.months' | t }}</span>
        </span>
        <app-icon name="bold-chevron-down" [size]="18" class="chev" />
      </button>

      <app-dialog [open]="open()" [title]="'summary.title' | t" (closed)="open.set(false)"><ng-template>
        <div class="head">
          
          <h2 class="name">{{ selectedOffer.productName }}</h2>
        </div>
        <dl class="rows">
          <div class="row"><dt>{{ 'step.terms.principal' | t }}</dt><dd>{{ money(selectedOffer.amount) }}</dd></div>
          <div class="row"><dt>{{ 'step.terms.tenor' | t }}</dt><dd>{{ selectedOffer.tenorMonths }} {{ 'step.offers.months' | t }}</dd></div>
          <div class="row"><dt>{{ 'step.offers.monthly' | t }}</dt><dd>{{ money(selectedOffer.calculation.installmentRepayment) }}</dd></div>
          @if (selectedOffer.calculation.rate !== null) { <div class="row"><dt>{{ 'step.terms.rate' | t }}</dt><dd>{{ selectedOffer.calculation.rate }}%</dd></div> }
          @if (fees() > 0) {
            <div class="row"><dt>{{ 'step.terms.fees' | t }}</dt><dd>{{ money(fees()) }}</dd></div>
          }
          <div class="row row--strong"><dt>{{ 'step.terms.total' | t }}</dt><dd>{{ money(selectedOffer.calculation.totalRepayment) }}</dd></div>
        </dl>
        <button appButton variant="secondary" type="button" class="alt change" (click)="change()">{{ 'summary.change' | t }}</button>
        <p class="note">{{ 'summary.change.hint' | t }}</p>
      </ng-template></app-dialog>
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
  private readonly state = inject(ApplicationStore);
  private readonly router = inject(Router);

  protected readonly money = formatNaira;
  protected readonly open = signal(false);
  protected readonly offer = computed(() => this.state.application()?.offer);
  protected readonly fees = computed(() => (this.offer()?.calculation.fees ?? []).reduce((sum, fee) => sum + fee.amount, 0));

  /** Back to the amount and period. The steps after this one are repeated, because they depend on the figures. */
  protected change(): void {
    this.open.set(false);
    void this.router.navigateByUrl(APPLY.offers);
  }
}