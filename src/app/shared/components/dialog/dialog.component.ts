import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, TemplateRef, ViewContainerRef,
  contentChild, effect, inject, input, output, untracked, viewChild,
} from '@angular/core';
import { filter, takeUntil } from 'rxjs';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ButtonDirective } from '../button/button.directive';

type DialogLayout = 'center' | 'sheet' | 'wide-sheet';
type DialogDismissal = 'all' | 'escape' | 'explicit';

@Component({
  selector: 'app-dialog',
  imports: [NgTemplateOutlet, ButtonDirective, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css',
})
export class DialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly layout = input<DialogLayout>('center');
  readonly dismissal = input<DialogDismissal>('all');
  readonly showClose = input(true);
  readonly autoFocus = input('first-heading');
  readonly closed = output<void>();

  protected readonly content = contentChild.required(TemplateRef);
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  private readonly dialogs = inject(Dialog);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private ref?: DialogRef;

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => {
        if (open && !this.ref) this.show();
        if (!open) this.ref?.close();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      const ref = this.ref;
      this.ref = undefined;
      ref?.close();
    });
  }

  close(): void {
    this.ref?.close();
  }

  private show(): void {
    const ref = this.dialogs.open(this.panel(), {
      viewContainerRef: this.viewContainerRef,
      panelClass: ['princeps-dialog', 'princeps-dialog--' + this.layout()],
      backdropClass: 'princeps-dialog-backdrop',
      ariaLabelledBy: null,
      ariaLabel: this.title(),
      ariaModal: true,
      autoFocus: this.autoFocus(),
      restoreFocus: true,
      disableClose: this.dismissal() !== 'all',
    });
    this.ref = ref;

    if (this.dismissal() === 'escape') {
      ref.keydownEvents.pipe(
        filter((event) => event.key === 'Escape' && !event.defaultPrevented),
        takeUntil(ref.closed),
      ).subscribe((event) => {
        event.preventDefault();
        ref.close();
      });
    }
    ref.closed.subscribe(() => {
      if (this.ref !== ref) return;
      this.ref = undefined;
      this.closed.emit();
    });
  }
}
