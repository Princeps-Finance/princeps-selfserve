import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TPipe } from '../core/i18n/t.pipe';
import { telLink, whatsappLink } from '../core/support';

/** Under an error that the customer cannot fix alone: a way to reach a person, so nobody is left at a dead end. */
@Component({
  selector: 'app-help-links',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="help">
      {{ 'help.stuck' | t }}
      <a [attr.href]="wa" target="_blank" rel="noopener">WhatsApp</a>
      ·
      <a [attr.href]="tel">{{ 'help.call.short' | t }}</a>
    </span>
  `,
  styles: [
    `
      .help { display: block; margin-top: var(--space-2); font-size: var(--fs-sm); color: var(--ink-soft); }
      a { color: var(--text-accent); font-weight: 500; text-underline-offset: 3px; }
    `,
  ],
})
export class HelpLinksComponent {
  readonly topic = input('Hello Princeps, I need help with my application.');
  protected get wa(): string {
    return whatsappLink(this.topic());
  }
  protected readonly tel = telLink();
}
