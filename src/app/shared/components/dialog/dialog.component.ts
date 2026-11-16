import type { DialogRef } from '@angular/cdk/dialog';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, Injector, TemplateRef, ViewContainerRef,
  contentChild, effect, inject, input, output, untracked, viewChild,
} from '@angular/core';
import { filter, takeUntil } from 'rxjs';
import { TPipe } from '../../../core/i18n/t.pipe';
import { IconComponent } from '../icon.component';

type DialogLayout = 'center' | 'sheet' | 'wide-sheet';
type DialogDismissal = 'all' | 'escape' | 'explicit';

@Component({
  selector: 'app-dialog',
  imports: [NgTemplateOutlet, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css',
})
export class DialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly layout = input<DialogLayout>('wide-sheet');
  readonly dismissal = input<DialogDismissal>('all');
  readonly showClose = input(true);
  readonly autoFocus = input('first-heading');
  readonly closed = output<void>();

  protected readonly content = contentChild.required(TemplateRef);
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  private readonly injector = inject(Injector);
  private loading = false;
  private destroyed = false;
  private readonly viewContainerRef = inject(ViewContainerRef);
  private ref?: DialogRef;

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => {
        if (open && !this.ref && !this.loading) void this.show().catch(() => { if (!this.destroyed) this.closed.emit(); });
        if (!open) this.ref?.close();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      const ref = this.ref;
      this.ref = undefined;
      ref?.close();
    });
  }

  close(): void {
    this.ref?.close();
  }

  private async show(): Promise<void> {
    this.loading = true;
    try {
      const { Dialog } = await import('@angular/cdk/dialog');
      if (this.destroyed || !this.open()) return;
      this.attach(this.injector.get(Dialog));
    } finally {
      this.loading = false;
    }
  }

  private attach(dialogs: import('@angular/cdk/dialog').Dialog): void {
    const ref = dialogs.open(this.panel(), {
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
