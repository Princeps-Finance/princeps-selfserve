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
    <dialog #dlg class="modal glass" aria-labelledby="modal-title" (close)="closed.emit()" (click)="onBackdrop($event)">
      <div class="panel">
        <header class="bar">
          <h2 id="modal-title" class="title">{{ title() }}</h2>
          <button type="button" class="x" [attr.aria-label]="'common.close' | t" (click)="dlg.close()">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </header>
        <div class="body"><ng-content /></div>
      </div>
    </dialog>
  `,
  styles: [
    `
      .modal {
        width: min(760px, 100vw); max-width: 100vw; height: min(92dvh, 900px); max-height: 100dvh;
        margin: auto auto 0; padding: 0; border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        color: var(--ink); box-shadow: var(--shadow-4);
      }
      @media (min-width: 640px) { .modal { margin: auto; border-radius: var(--radius-lg); } }
      .modal::backdrop { background: var(--overlay); }
      .panel { display: flex; flex-direction: column; height: 100%; }
      .bar { flex: none; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) var(--space-3) var(--space-2) var(--space-5); }
      .title { margin: 0; font-family: var(--font-display); font-size: var(--fs-xl); font-weight: 600; }
      .x {
        flex: none; width: var(--tap-min); height: var(--tap-min); display: grid; place-items: center; border: 0; border-radius: 50%;
        background: var(--grey-100); color: var(--ink); cursor: pointer;
      }
      .x:hover { background: var(--grey-200); }
      .x:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
      .body { flex: 1; min-height: 0; overflow: auto; padding: 0 var(--space-5) var(--space-5); }
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
