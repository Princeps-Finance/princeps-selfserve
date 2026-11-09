import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IllustrationName = 'shield' | 'message' | 'coins' | 'check' | 'document' | 'briefcase';

/**
 * Flat, decorative illustrations in the brand colours (navy, cyan, orange: the logo's triangles).
 * Purely visual, so hidden from screen readers; the screen's heading says what it is about.
 */
@Component({
  selector: 'app-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="art" viewBox="0 0 160 120" fill="none" aria-hidden="true" focusable="false" [style.width.px]="size()" [style.height.px]="size() * 0.75">
      <circle cx="80" cy="62" r="48" fill="#E8EEF7" />
      @switch (name()) {
        @case ('shield') {
          <path d="M80 22 L112 34 V60 C112 80 98 92 80 100 C62 92 48 80 48 60 V34 Z" fill="#0B2B55" />
          <path d="M66 60 L76 70 L96 48" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="118" cy="30" r="7" fill="#F16522" />
          <path d="M34 84 L46 64 L58 84 Z" fill="#51C4D9" />
        }
        @case ('message') {
          <rect x="44" y="30" width="72" height="50" rx="12" fill="#0B2B55" />
          <path d="M60 80 L60 94 L76 80 Z" fill="#0B2B55" />
          <circle cx="62" cy="55" r="5" fill="#fff" />
          <circle cx="80" cy="55" r="5" fill="#fff" />
          <circle cx="98" cy="55" r="5" fill="#fff" />
          <circle cx="122" cy="34" r="7" fill="#F16522" />
          <path d="M30 88 L42 68 L54 88 Z" fill="#51C4D9" />
        }
        @case ('coins') {
          <ellipse cx="80" cy="88" rx="30" ry="9" fill="#0B2B55" />
          <rect x="50" y="68" width="60" height="20" fill="#0B2B55" />
          <ellipse cx="80" cy="68" rx="30" ry="9" fill="#51C4D9" />
          <ellipse cx="80" cy="46" rx="22" ry="7" fill="#fff" stroke="#F16522" stroke-width="3" stroke-dasharray="5 4" />
          <circle cx="122" cy="34" r="7" fill="#F16522" />
        }
        @case ('check') {
          <circle cx="80" cy="60" r="32" fill="#0B2B55" />
          <path d="M64 60 L76 72 L98 48" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M122 28 L132 46 L112 46 Z" fill="#51C4D9" />
          <circle cx="36" cy="40" r="6" fill="#F16522" />
          <circle cx="126" cy="86" r="4" fill="#F16522" />
        }
        @case ('document') {
          <rect x="52" y="24" width="56" height="74" rx="8" fill="#fff" stroke="#0B2B55" stroke-width="4" />
          <path d="M62 44 H98 M62 56 H98 M62 68 H84" stroke="#51C4D9" stroke-width="5" stroke-linecap="round" />
          <circle cx="102" cy="88" r="13" fill="#F16522" />
          <path d="M96 88 L100 92 L108 83" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        }
        @case ('briefcase') {
          <rect x="46" y="42" width="68" height="46" rx="9" fill="#0B2B55" />
          <path d="M66 42 V36 a6 6 0 0 1 6 -6 H88 a6 6 0 0 1 6 6 V42" stroke="#0B2B55" stroke-width="5" />
          <rect x="46" y="60" width="68" height="6" fill="#51C4D9" />
          <rect x="74" y="56" width="12" height="14" rx="3" fill="#F16522" />
        }
      }
    </svg>
  `,
  styles: [
    `
      :host { display: block; }
      .art { display: block; margin: 0 auto; }
    `,
  ],
})
export class IllustrationComponent {
  readonly name = input.required<IllustrationName>();
  /** Width in px; height follows the 4:3 artwork. */
  readonly size = input<number>(132);
}
