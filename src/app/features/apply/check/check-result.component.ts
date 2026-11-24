import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective } from '@princeps-finance/ui';
import { AnimatedIconComponent } from '../../../shared/components/animated-icon.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { formatNaira } from '../money';
import { CheckFlowService } from './check-flow.service';

@Component({
  selector: 'app-check-result',
  imports: [ButtonDirective, AnimatedIconComponent, TPipe],
  template: `
    <section class="step">
      @if (result(); as result) {
        <header class="head">
          <h1 class="title">
            {{
              (declined() ? 'check.result.declined.title' : 'check.result.title')
                | t: { amount: money(result.maximumAmount) }
            }}
          </h1>
          <p class="subtitle">
            {{
              (declined() ? 'check.result.declined.body' : 'check.result.sub')
                | t: { months: result.maximumTenor }
            }}
          </p>
        </header>
        @if (result.reasons.length) {
          <ul class="reasons">
            @for (reason of result.reasons; track reason) {
              <li>{{ reason }}</li>
            }
          </ul>
        }
        @if (result.eligibleProducts.length) {
          <section class="products" aria-labelledby="preview-products">
            <h2 id="preview-products">{{ 'check.result.products' | t }}</h2>
            <ul class="product-list">
              @for (product of result.eligibleProducts; track product.productId) {
                <li>
                  <span>{{ product.name }}</span
                  ><strong>{{ money(product.maxAmount) }}</strong>
                </li>
              }
            </ul>
          </section>
        }
        <div class="actions">
          @if (!declined()) {
            <button appButton class="cta" type="button" (click)="takeLoan()">
              {{ 'check.result.take' | t }}
              <app-animated-icon
                animation="arrow-right"
                fallback="outline-arrow-right"
                [size]="18"
              />
            </button>
            <p class="hint">{{ 'check.result.take.hint' | t }}</p>
          }
          <button appButton variant="secondary" type="button" (click)="again()">
            {{ 'check.result.again' | t }}
          </button>
        </div>
      }
    </section>
  `,
  styleUrl: '../apply-step.css',
  styles: [
    `
      .head {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .income {
        font-weight: 600;
      }
      .reasons {
        color: var(--ink-soft);
        line-height: 1.5;
      }
      .products h2 {
        font-size: var(--fs-lg);
      }
      .product-list {
        list-style: none;
        padding: 0;
        display: grid;
        gap: var(--space-2);
      }
      .product-list li {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-4);
        border-radius: var(--radius-md);
        background: var(--surface-2);
      }
      .actions {
        margin-top: auto;
        display: grid;
        gap: var(--space-3);
        padding-top: var(--space-5);
      }
      .hint {
        text-align: center;
        font-size: var(--fs-sm);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckResultComponent {
  readonly flow = inject(CheckFlowService);
  private readonly router = inject(Router);
  readonly result = this.flow.result;
  readonly declined = computed(() => this.result()?.decision === 'DECLINE');
  readonly money = formatNaira;

  constructor() {
    if (!this.result())
      void this.router.navigateByUrl('/apply/check/employment', { replaceUrl: true });
  }

  takeLoan() {
    void this.router.navigateByUrl('/apply/bvn');
  }

  again() {
    this.flow.reset();
    void this.router.navigateByUrl('/apply/check/employment');
  }
}
