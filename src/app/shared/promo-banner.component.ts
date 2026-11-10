import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-promo-banner',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="banner" aria-labelledby="banner-title">
      <img class="thumb" [ngSrc]="imageSrc()" width="664" height="420" alt="" />
      <div class="text">
        <h2 id="banner-title" class="title">{{ title() }}</h2>
        <p class="desc">{{ description() }}</p>
      </div>
      <button type="button" class="promo-cta" (click)="action.emit()">{{ ctaLabel() }}</button>
      <button type="button" class="close" [attr.aria-label]="dismissLabel()" (click)="dismissed.emit()">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .banner {
        display: flex; align-items: center; gap: var(--space-3);
        padding: var(--space-4); background: var(--banner-bg); border-radius: var(--radius-lg);
      }
      .thumb { flex: none; width: 48px; height: 48px; border-radius: var(--radius-sm); object-fit: cover; object-position: 50% 8%; }
      .text { flex: 1; min-width: 0; padding-right: var(--space-2); }
      .title { margin: 0; font: 600 15px/1.3 var(--font-sans); color: var(--text-primary); }
      .desc { margin: 2px 0 0; font: 400 13px/1.4 var(--font-sans); color: var(--grey-500); }
      .promo-cta {
        flex: none; display: flex; align-items: center; justify-content: center;
        height: 44px; padding: 0 var(--space-4); border: 0; border-radius: var(--btn-radius);
        background: var(--action-primary); color: var(--action-on-primary);
        font: 500 15px/1 var(--font-sans); cursor: pointer;
      }
      .promo-cta:hover { background: var(--action-primary-hover); }
      .close {
        flex: none; width: 28px; height: 28px; margin-right: calc(var(--space-1) * -1); border: 0; border-radius: 50%;
        display: grid; place-items: center; background: transparent; color: var(--grey-500); cursor: pointer;
      }
      .close:hover { background: var(--grey-200); }
      .promo-cta:focus-visible, .close:focus-visible { outline: 2px solid var(--grey-900); outline-offset: 2px; }
      @media (max-width: 359px) {
        .thumb { display: none; }
      }
    `,
  ],
})
export class PromoBannerComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly ctaLabel = input.required<string>();
  readonly dismissLabel = input('Dismiss');
  readonly imageSrc = input('brand/promo-illustration.svg');
  readonly action = output<void>();
  readonly dismissed = output<void>();
}
