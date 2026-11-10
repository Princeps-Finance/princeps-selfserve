import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CardComponent } from './card.component';

/**
 * The "Why we ask: ..." note under a screen's heading, as a card. The words before the first colon are the lead
 * and are set in bold; the rest is the reason.
 */
@Component({
  selector: 'app-why-ask',
  imports: [CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card>
      <p class="why">
        <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" />
        </svg>
        <span>
          @if (lead()) { <strong>{{ lead() }}</strong> }
          {{ rest() }}
        </span>
      </p>
    </app-card>
  `,
  styles: [
    `
      :host { display: block; }
      .why { margin: 0; display: flex; gap: var(--space-3); align-items: flex-start; font-size: var(--fs-md); line-height: 1.5; color: var(--ink-soft); }
      .icon { flex: none; margin-top: 2px; color: var(--ink-muted); }
      strong { color: var(--ink); font-weight: 600; margin-right: 2px; }
    `,
  ],
})
export class WhyAskComponent {
  readonly text = input.required<string>();
  private readonly split = computed(() => {
    const t = this.text();
    const i = t.indexOf(':');
    return i > 0 && i < 40 ? { lead: t.slice(0, i + 1), rest: t.slice(i + 1).trim() } : { lead: '', rest: t };
  });
  protected readonly lead = computed(() => this.split().lead);
  protected readonly rest = computed(() => this.split().rest);
}
