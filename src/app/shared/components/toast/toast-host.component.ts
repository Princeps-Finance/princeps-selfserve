import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, TemplateRef,
  ViewContainerRef, afterRenderEffect, computed, effect, inject, input, signal,
  viewChild, viewChildren,
} from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { Toast, ToastService } from '../../../core/toast/toast.service';

type ToastPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

@Component({
  selector: 'app-toast-host',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.css',
})
export class ToastHostComponent {
  readonly position = input<ToastPosition>('top-center');

  protected readonly toastService = inject(ToastService);
  protected readonly toasts = computed(() => [...this.toastService.toasts()].reverse());
  protected readonly bottom = computed(() => this.position().startsWith('bottom'));
  protected readonly modalOpen = signal(false);
  private readonly hovered = signal(false);
  private readonly focused = signal(false);
  private readonly touchExpanded = signal(false);
  protected readonly expanded = computed(() => this.hovered() || this.focused() || this.touchExpanded());
  private readonly heights = signal<readonly number[]>([]);
  protected readonly frontHeight = computed(() => this.heights()[0] ?? 0);
  protected readonly offsets = computed(() => {
    let height = 0;
    return this.heights().map((cardHeight) => {
      const offset = height;
      height += cardHeight;
      return offset;
    });
  });
  protected readonly totalHeight = computed(() => this.heights().reduce((sum, height) => sum + height, 0));

  private readonly injector = inject(Injector);
  private readonly view = inject(ViewContainerRef);
  private readonly template = viewChild.required<TemplateRef<unknown>>('stack');
  private readonly cards = viewChildren<ElementRef<HTMLElement>>('card');

  constructor() {
    effect(() => {
      if (!this.toasts().length) {
        this.hovered.set(false);
        this.focused.set(false);
        this.touchExpanded.set(false);
      }
      this.toastService.setStackPaused(this.expanded());
    });

    const hasToasts = computed(() => this.toasts().length > 0);
    effect((cleanup) => {
      if (!hasToasts()) return;
      const cancellation = new AbortController();
      cleanup(() => cancellation.abort());
      void this.mountStack(this.template(), cancellation.signal);
    });

    afterRenderEffect({
      read: (cleanup) => {
        const cards = this.cards();
        const measure = () => this.heights.set(cards.map(({ nativeElement }) => nativeElement.offsetHeight));
        measure();
        if (!cards.length || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        for (const card of cards) observer.observe(card.nativeElement);
        cleanup(() => observer.disconnect());
      },
    });

    inject(DestroyRef).onDestroy(() => this.toastService.setStackPaused(false));
  }

  private async mountStack(template: TemplateRef<unknown>, signal: AbortSignal): Promise<void> {
    const [{ Dialog }, cdk, { TemplatePortal }] = await Promise.all([
      import('@angular/cdk/dialog'),
      import('@angular/cdk/overlay'),
      import('@angular/cdk/portal'),
    ]);
    if (signal.aborted) return;

    const dialog = this.injector.get(Dialog);
    const container = this.injector.get(cdk.OverlayContainer).getContainerElement();
    const position = cdk.createGlobalPositionStrategy(this.injector).top('0').left('0');
    const overlay = cdk.createOverlayRef(this.injector, {
      positionStrategy: position,
      width: '100%',
      height: '100%',
      panelClass: 'princeps-toast-overlay',
      usePopover: true,
    });
    const host = overlay.hostElement;
    host.classList.add('princeps-toast-layer');
    overlay.attach(new TemplatePortal(template, this.view));

    const syncModal = () => this.modalOpen.set(dialog.openDialogs.length > 0);
    syncModal();
    const observer = new MutationObserver((records) => {
      syncModal();
      const openedPopover = records.some(({ addedNodes }) =>
        Array.from(addedNodes).some((node) =>
          node !== host && node instanceof HTMLElement && node.classList.contains('cdk-overlay-popover'),
        ),
      );
      // Native top-layer order follows when each popover was shown.
      if (openedPopover && host.matches(':popover-open')) {
        host.hidePopover();
        host.showPopover();
      }
    });
    observer.observe(container, { childList: true });
    signal.addEventListener('abort', () => {
      observer.disconnect();
      overlay.dispose();
    }, { once: true });
  }

  protected enter(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') this.hovered.set(true);
  }

  protected leave(): void {
    this.hovered.set(false);
  }

  protected focus(event: FocusEvent): void {
    // Touch buttons can receive focus too. Let the explicit touch toggle control expansion.
    if ((event.target as HTMLElement).matches(':focus-visible')) this.focused.set(true);
  }

  protected blur(event: FocusEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      this.focused.set(false);
    }
  }

  protected toggleFromBody(event: PointerEvent): void {
    if (event.pointerType === 'touch' && this.toasts().length > 1) {
      this.touchExpanded.update((value) => !value);
    }
  }

  protected dismiss(toast: Toast, event?: Event): void {
    event?.stopPropagation();
    this.focused.set(false);
    this.toastService.dismiss(toast.id);
  }

  protected run(toast: Toast): void {
    this.dismiss(toast);
    toast.action?.run();
  }
}
