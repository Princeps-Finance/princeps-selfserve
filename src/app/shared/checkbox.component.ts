import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * Raised tick checkbox (Figma "Checkbox - Tick"). The two Figma properties map to:
 *  - State (Active / Inactive) -> `checked`
 *  - Hover (On / Off)          -> the :hover state, pointer devices only
 * Put it inside a <label> with the text; the label makes the whole row clickable. The native input stays in the DOM, so keyboard and screen readers behave as usual.
 * Colours come from the app tokens, not from the Figma file.
 */
@Component({
  selector: 'app-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="cb">
      <input
        type="checkbox"
        class="cb-input"
        [checked]="checked()"
        [disabled]="disabled()"
        [attr.aria-invalid]="invalid() ? true : null"
        [attr.aria-describedby]="describedBy()"
        (change)="checked.set($any($event.target).checked)"
      />
      <span class="cb-box" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    </span>
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .cb { position: relative; display: inline-flex; cursor: pointer; }
      /* Global input[type=checkbox] styling is overridden: the input is only the accessible hit target. */
      .cb-input {
        position: absolute; inset: 0 auto 0 0; width: 26px; height: 26px; margin: 0; opacity: 0; cursor: inherit;
      }
      .cb-box {
        flex: none; display: grid; place-items: center; box-sizing: border-box;
        width: 26px; height: 26px; border-radius: 8px;
        color: var(--action-on-primary);
        background: var(--surface-0);
        border: 1.5px solid var(--input-border);
        box-shadow: var(--shadow-1);
        transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 160ms ease-out,
          background-color 140ms ease-out, border-color 140ms ease-out;
      }
      .cb-box svg { width: 16px; height: 16px; opacity: 0; transform: scale(0.8); transition: opacity 120ms ease-out, transform 160ms cubic-bezier(0.23, 1, 0.32, 1); }
      .cb-input:checked + .cb-box { background: var(--action-primary); border-color: var(--action-primary); }
      .cb-input:checked + .cb-box svg { opacity: 1; transform: scale(1); }
      /* Hover = On: lifts and gains a deeper shadow. Pointer devices only, so touch never sticks. */
      @media (hover: hover) and (pointer: fine) {
        .cb:hover .cb-input:not(:disabled) + .cb-box { transform: translateY(-1px); box-shadow: var(--shadow-2); }
      }
      .cb-input:not(:disabled):active + .cb-box { transform: scale(0.97); }
      .cb-input:focus-visible + .cb-box { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
      .cb-input[aria-invalid='true'] + .cb-box { border-color: var(--danger-text); }
      .cb-input:disabled + .cb-box { opacity: 0.5; box-shadow: none; }
      @media (prefers-reduced-motion: reduce) {
        .cb-box, .cb-box svg { transition: none; }
        .cb:hover .cb-input + .cb-box { transform: none; }
      }
    `,
  ],
})
export class CheckboxComponent {
  /** State: Active when true. Two-way bindable: `[(checked)]`. */
  readonly checked = model(false);
  readonly disabled = input(false);
  readonly invalid = input(false);
  /** Id of the error message, wired to the native input. */
  readonly describedBy = input<string | null>(null);
}
