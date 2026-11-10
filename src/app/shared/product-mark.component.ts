import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Product } from '../core/products/products';

/**
 * The picture for a loan product. Uses the product's own logo when Caltos supplies one (`logoUrl`), otherwise a
 * tile in the product's colours with its symbol, so every product has an image from the start.
 */
@Component({
  selector: 'app-product-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (product().logoUrl; as src) {
      <img class="mark" [src]="src" alt="" width="44" height="44" loading="lazy" />
    } @else {
      <span class="mark tile" [style.background]="'linear-gradient(135deg,' + product().hero.from + ',' + product().hero.to + ')'" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="product().hero.glyph" /></svg>
      </span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; flex: none; }
      .mark { width: 44px; height: 44px; border-radius: var(--radius-sm); object-fit: cover; background: var(--grey-100); }
      .tile { display: grid; place-items: center; }
    `,
  ],
})
export class ProductMarkComponent {
  readonly product = input.required<Product>();
}
