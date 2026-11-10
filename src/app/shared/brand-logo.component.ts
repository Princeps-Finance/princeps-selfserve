import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The Princeps logo. The dark-theme version swaps the black wordmark for white so it stays readable. */
@Component({
  selector: 'app-brand-logo',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img class="light" ngSrc="/brand/princeps-logo.svg" [width]="width()" [height]="height()" alt="Princeps Credit Systems Limited" priority />
    <img class="dark" ngSrc="/brand/princeps-logo-dark.svg" [width]="width()" [height]="height()" alt="" aria-hidden="true" />
  `,
  styles: [
    `
      :host { display: inline-block; line-height: 0; }
      img { height: 100%; width: auto; display: block; }
      .dark { display: none; }
      :host-context([data-theme='dark']) .light { display: none; }
      :host-context([data-theme='dark']) .dark { display: block; }
      @media (prefers-color-scheme: dark) {
        :host-context(:root:not([data-theme='light'])) .light { display: none; }
        :host-context(:root:not([data-theme='light'])) .dark { display: block; }
      }
    `,
  ],
})
export class BrandLogoComponent {
  readonly width = input(116);
  readonly height = input(32);
}
