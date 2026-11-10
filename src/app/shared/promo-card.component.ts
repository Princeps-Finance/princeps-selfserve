import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-promo-card',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" [attr.aria-labelledby]="'promo-title'">
      <div class="media">
        <img [ngSrc]="imageSrc()" [width]="664" [height]="420" [alt]="imageAlt()" />
        @if (dismissible()) {
          <button type="button" class="close" [attr.aria-label]="dismissLabel()" (click)="dismissed.emit()">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        }
      </div>
      <div class="body">
        <h2 id="promo-title" class="title">
          {{ title() }}
          @if (badge()) {
            <span class="badge">{{ badge() }}</span>
          }
        </h2>
        <p class="desc">{{ description() }}</p>
        <button type="button" class="promo-cta" (click)="action.emit()">{{ ctaLabel() }}</button>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; width: 268px; max-width: calc(100vw - 32px); }
      .card {
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--card-shadow);
        overflow: hidden;
      }
      .media { position: relative; background: var(--grey-100); aspect-ratio: 664 / 420; }
      .media img { display: block; width: 100%; height: 100%; object-fit: cover; }
      .close {
        position: absolute; top: 8px; right: 8px;
        width: 28px; height: 28px; border: 0; border-radius: 50%;
        display: grid; place-items: center; cursor: pointer;
        background: rgba(17, 18, 20, 0.5); color: #fff;
        transition: background 120ms ease;
      }
      .close:hover { background: rgba(17, 18, 20, 0.7); }
      .close:focus-visible, .promo-cta:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 2px; }
      .close:focus-visible { outline-color: #fff; }
      .body { padding: var(--space-4); }
      .title {
        display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: var(--space-2);
        margin: 0; text-align: left; font: 600 15px/1.25 var(--font-sans); color: var(--text-primary);
      }
      .badge {
        padding: 1px var(--space-2); border-radius: var(--radius-pill);
        background: var(--badge-new-bg); color: var(--badge-new-text);
        font: 600 11px/16px var(--font-sans);
      }
      .desc { margin: var(--space-2) 0 var(--space-3); font: 400 13px/1.5 var(--font-sans); color: var(--grey-500); }
      .promo-cta {
        display: flex; align-items: center; justify-content: center;
        width: 100%; height: 44px; padding: 0; border: 0; border-radius: var(--btn-radius);
        background: var(--action-primary); color: var(--action-on-primary);
        font: 500 14px/1 var(--font-sans); cursor: pointer;
        transition: background 120ms ease;
      }
      .promo-cta:hover { background: var(--action-primary-hover); }
      .promo-cta:active { background: var(--action-primary-active); }
      @media (prefers-reduced-motion: reduce) { .close, .promo-cta { transition: none; } }
    `,
  ],
})
export class PromoCardComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly ctaLabel = input.required<string>();
  readonly imageSrc = input('brand/promo-illustration.svg');
  readonly imageAlt = input('');
  readonly badge = input<string>();
  readonly dismissLabel = input('Dismiss');
  readonly dismissible = input(true);
  readonly action = output<void>();
  readonly dismissed = output<void>();
}
