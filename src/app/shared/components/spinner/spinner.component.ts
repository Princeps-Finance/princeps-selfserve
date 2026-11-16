import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.inline]': 'inline()' },
  template: `
    <span class="ring" aria-hidden="true"></span>
    @if (label()) {
      <span class="sr-only" role="status">{{ label() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 3rem;
      color: var(--text-accent);
    }
    :host(.inline) {
      display: inline-flex;
      min-height: 0;
      color: inherit;
      vertical-align: middle;
    }
    .ring {
      box-sizing: border-box;
      width: 1.5rem;
      aspect-ratio: 1;
      border: 2px solid currentColor;
      border-inline-end-color: transparent;
      border-radius: 50%;
      animation: spin 700ms linear infinite;
    }
    :host(.inline) .ring {
      width: 1em;
    }
    @keyframes spin {
      to {
        transform: rotate(1turn);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ring {
        animation: none;
      }
    }
  `,
})
export class SpinnerComponent {
  readonly label = input('');
  readonly inline = input(false);
}
