import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-promo-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="banner" aria-labelledby="banner-title">
      <svg class="mark" width="44" height="44" viewBox="0 0 56 56" aria-hidden="true">
        <g transform="translate(28 28)">
          @for (r of rotations; track r; let i = $index) {
            <rect x="-4" y="-26" width="8" height="18" rx="4" [attr.transform]="'rotate(' + r + ')'" [attr.fill]="colors[i % 3]" />
          }
        </g>
      </svg>
      <div class="text">
        <h2 id="banner-title" class="title">{{ title() }}</h2>
        <p class="desc">{{ description() }}</p>
      </div>
      <button type="button" class="cta" (click)="action.emit()">{{ ctaLabel() }}</button>
      <button type="button" class="close" aria-label="Dismiss" (click)="dismissed.emit()">
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
        position: relative; display: flex; align-items: center; gap: var(--space-3);
        padding: var(--space-4); background: var(--banner-bg); border-radius: var(--radius-lg);
      }
      .mark { flex: none; }
      .text { flex: 1; min-width: 0; padding-right: var(--space-2); }
      .title { margin: 0; font: 600 15px/1.3 var(--font-sans); color: var(--text-primary); }
      .desc { margin: 2px 0 0; font: 400 13px/1.4 var(--font-sans); color: var(--grey-500); }
      .cta {
        flex: none; display: flex; align-items: center; justify-content: center;
        height: 44px; padding: 0 var(--space-5); border: 0; border-radius: var(--radius-md);
        background: var(--action-neutral); color: var(--action-on-neutral);
        font: 500 15px/1 var(--font-sans); cursor: pointer;
      }
      .cta:hover { background: var(--action-neutral-hover); }
      .close {
        position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; border: 0; border-radius: 50%;
        display: grid; place-items: center; background: transparent; color: var(--grey-500); cursor: pointer;
      }
      .close:hover { background: var(--grey-200); }
      .cta:focus-visible, .close:focus-visible { outline: 2px solid var(--grey-900); outline-offset: 2px; }
      @media (max-width: 359px) {
        .banner { flex-wrap: wrap; }
        .text { flex-basis: calc(100% - 60px); }
        .cta { width: 100%; }
      }
    `,
  ],
})
export class PromoBannerComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly ctaLabel = input.required<string>();
  readonly action = output<void>();
  readonly dismissed = output<void>();
  protected readonly rotations = [0, 45, 90, 135, 180, 225, 270, 315];
  protected readonly colors = ['#f16522', '#51c4d9', '#0b2b55'];
}
