import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/**
 * A soft card: a rounded panel with an optional heading. Use it for a group of related facts, and put plain
 * content inside. `tone="accent"` gives a tinted card for a note that should stand out.
 */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tone]': 'tone()' },
  template: `
    <section class="card" [attr.aria-labelledby]="title() ? headingId : null">
      @if (title()) {
        <h2 class="card-title" [id]="headingId">{{ title() }}</h2>
      }
      <ng-content />
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .card { padding: var(--space-4) var(--space-5); border-radius: var(--radius-lg); background: var(--input-bg); }
      :host([data-tone='accent']) .card { background: color-mix(in srgb, var(--action-primary) 10%, transparent); }
      .card-title { margin: 0 0 var(--space-2); font-family: var(--font-display); font-size: var(--fs-base); font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
    `,
  ],
})
export class CardComponent {
  readonly title = input<string>('');
  readonly tone = input<'default' | 'accent'>('default');
  protected readonly headingId = `card-title-${nextId++}`;
}
