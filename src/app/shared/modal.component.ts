import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { TPipe } from '../core/i18n/t.pipe';

/**
 * A modal window: native dialog, so focus is trapped, Escape closes it and focus returns to what opened it.
 * The parent owns `open` and sets it back to false when `closed` fires.
 */
@Component({
  selector: 'app-modal',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="modal" aria-labelledby="modal-title" (close)="closed.emit()" (click)="onBackdrop($event)">
      <div class="panel">
        <button type="button" class="back" (click)="dlg.close()">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12 4L6 10l6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>{{ 'common.back' | t }}</span>
        </button>
        <h2 id="modal-title" class="sr-only">{{ title() }}</h2>
        <div class="card"><ng-content /></div>
      </div>
    </dialog>
  `,
  styles: [
    `
      /* Phone: a sheet that rises from the bottom. Wider screens: a centred panel. Same content either way. */
      .modal {
        width: min(680px, 100vw); max-width: 100vw; height: min(92dvh, 900px); max-height: 100dvh;
        margin: auto auto 0; padding: 0; border: 0; border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        background: var(--surface-2); color: var(--ink); box-shadow: var(--shadow-4);
        overflow: hidden;
      }
      .modal[open] { animation: sheet-up 240ms cubic-bezier(0.23, 1, 0.32, 1) both; }
      .modal[open]::backdrop { animation: fade-in 200ms ease-out both; }
      @media (min-width: 640px) {
        .modal { margin: auto; border-radius: var(--radius-xl); height: min(88dvh, 820px); }
        .modal[open] { animation-name: pop-in; }
      }
      .modal::backdrop { background: var(--overlay); }
      .panel { display: flex; flex-direction: column; gap: var(--space-3); height: 100%; padding: var(--space-4) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom)); box-sizing: border-box; }
      .back {
        flex: none; align-self: flex-start; display: inline-flex; align-items: center; gap: var(--space-1);
        min-height: 44px; padding: 0 var(--space-4) 0 var(--space-3); border: 0; border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink); font: 500 var(--fs-base) var(--font-sans); cursor: pointer;
        transition: transform 120ms ease-out, background 160ms ease;
      }
      .back:active { transform: scale(0.97); }
      .back:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
      @media (hover: hover) and (pointer: fine) { .back:hover { background: color-mix(in srgb, var(--ink) 12%, transparent); } }
      .card { flex: 1; min-height: 0; overflow: auto; padding: var(--space-4); border-radius: var(--radius-lg); background: var(--surface-0); box-shadow: var(--shadow-1); }
      .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
      @keyframes sheet-up { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
      @keyframes pop-in { from { transform: scale(0.97); opacity: 0; } to { transform: none; opacity: 1; } }
      @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { .modal[open], .modal[open]::backdrop { animation: none; } .back { transition: none; } }
    `,
  ],
})
export class ModalComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly closed = output<void>();
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.open() && !el.open) el.showModal();
      else if (!this.open() && el.open) el.close();
    });
  }

  /** A click on the dimmed area (the dialog element itself, not its content) closes the window. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dlg().nativeElement) this.dlg().nativeElement.close();
  }
}
