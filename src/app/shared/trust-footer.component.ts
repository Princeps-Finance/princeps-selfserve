import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TPipe } from '../core/i18n/t.pipe';
import { PrivacyService } from '../core/privacy/privacy.service';
import { LICENCE_NUMBER } from '../core/support';

/** The short regulatory and safety text shown at the foot of the first screens. */
@Component({
  selector: 'app-trust-footer',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="trust">
      <p>{{ 'trust.cbn' | t }}@if (licence) { · {{ 'trust.licence' | t }} {{ licence }} }</p>
      <p>{{ 'trust.official' | t }}</p>
      <button type="button" class="link" (click)="privacy.open()">{{ 'privacy.link' | t }}</button>
    </footer>
  `,
  styles: [
    `
      :host { display: block; }
      .trust { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); font-size: var(--fs-sm); line-height: 1.5; color: var(--ink-muted); }
      p { margin: 0; }
      .link {
        min-height: var(--tap-min); padding: 0; border: 0; background: none; color: var(--ink-soft);
        font: inherit; text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
      }
      .link:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); border-radius: 4px; }
    `,
  ],
})
export class TrustFooterComponent {
  protected readonly privacy = inject(PrivacyService);
  protected readonly licence = LICENCE_NUMBER;
}
