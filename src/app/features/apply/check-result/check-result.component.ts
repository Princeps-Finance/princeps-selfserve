import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { formatNaira } from '../../../core/money.util';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { productsFor } from '../../../core/products/products';
import { telLink, whatsappLink } from '../../../core/support';
import { ProductMarkComponent } from '../../../shared/product-mark.component';

/**
 * The end of the "how much can I get" check: no BVN, no code. Shows the estimate and the loans it applies to,
 * then lets the customer take a loan (BVN next, work details not asked again) or check again.
 */
@Component({
  selector: 'app-check-result',
  imports: [TPipe, ProductMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="step">
      @if (declined()) {
        <header class="head">
          <h1 class="title">{{ 'check.result.declined.title' | t }}</h1>
          <p class="subtitle">{{ 'check.result.declined.body' | t }}</p>
        </header>
        <div class="actions">
          <button type="button" class="cta" (click)="checkAgain()">{{ 'check.result.again' | t }}</button>
          <a class="alt" [attr.href]="whatsapp" target="_blank" rel="noopener">{{ 'step.eligibility.declined.whatsapp' | t }}</a>
          <a class="alt" [attr.href]="tel">{{ 'step.eligibility.declined.call' | t }}</a>
        </div>
      } @else {
        <header class="head">
          <h1 class="title">{{ 'check.result.title' | t: { amount: money(max()) } }}</h1>
          <p class="subtitle">{{ 'check.result.sub' | t: { months: months() } }}</p>
          @if (income() > 0) {
            <p class="income">{{ 'check.result.income' | t: { amount: money(income()) } }}</p>
          }
        </header>

        @if (products().length) {
          <section class="products" aria-labelledby="products-title">
            <h2 id="products-title" class="products-title">{{ 'check.result.products' | t }}</h2>
            <ul class="list">
              @for (p of products(); track p.product.id) {
                <li class="item">
                  <app-product-mark [product]="p.product" />
                  <span class="item-text">
                    <span class="item-name">{{ p.product.name }}</span>
                    <span class="item-meta">{{ 'check.result.upto' | t: { amount: money(p.upTo) } }}</span>
                  </span>
                </li>
              }
            </ul>
          </section>
        }

        <div class="actions">
          <button type="button" class="cta" (click)="takeLoan()">
            <span>{{ 'check.result.take' | t }}</span>
            <svg class="cta-arrow" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <p class="hint">{{ 'check.result.take.hint' | t }}</p>
          <button type="button" class="alt" (click)="checkAgain()">{{ 'check.result.again' | t }}</button>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .step { gap: var(--space-5); padding-top: var(--space-4); }
      .head { display: flex; flex-direction: column; gap: var(--space-2); }
      .title { font-size: clamp(26px, 7vw, 34px); line-height: 1.1; letter-spacing: -0.02em; }
      .subtitle { margin: 0; color: var(--ink-soft); line-height: 1.5; }
      .income { margin: 0; font-weight: 600; }
      .products-title { margin: 0 0 var(--space-2); font-size: var(--fs-lg); }
      .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
      .item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border-radius: var(--radius-md); background: var(--grey-100); }
      .item-text { display: flex; flex-direction: column; min-width: 0; }
      .item-name { font-weight: 600; }
      .item-meta { font-size: var(--fs-md); color: var(--ink-soft); }
      .actions { margin-top: auto; display: flex; flex-direction: column; gap: var(--space-2); padding-top: var(--space-4); }
      .hint { margin: 0; text-align: center; font-size: var(--fs-md); color: var(--ink-soft); }
      .cta-arrow { transition: transform 200ms cubic-bezier(0.2, 0.7, 0.1, 1); }
      .cta:hover:not(:disabled) .cta-arrow { transform: translateX(3px); }
    `,
  ],
})
export class CheckResultComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  protected readonly money = formatNaira;
  protected readonly declined = computed(() => this.state.eligibility()?.decision === 'declined');
  protected readonly whatsapp = whatsappLink('Hello Princeps, I checked how much I can get and I would like help.');
  protected readonly tel = telLink();
  protected readonly max = computed(() => this.state.eligibility()?.maxEligibleAmount ?? 0);
  protected readonly income = computed(() => this.state.salary()?.monthlyIncome ?? 0);
  protected readonly months = computed(() => this.state.eligibility()?.tenorMonths ?? 0);

  /** The loans that match what the customer told us, each capped at what they can get. */
  protected readonly products = computed(() => {
    const employment = this.state.employment();
    const salary = this.state.salary();
    if (!employment || !salary) return [];
    return productsFor(employment.type, salary.channel).map((product) => ({
      product,
      upTo: Math.min(product.maxAmount, this.max()),
    }));
  });

  /** Identity comes next. The work details stay, so they are not asked again. */
  protected takeLoan(): void {
    this.state.setIntent('apply');
    void this.flow.go(APPLY.bvn);
  }

  protected checkAgain(): void {
    void this.flow.go(APPLY.employment);
  }
}
