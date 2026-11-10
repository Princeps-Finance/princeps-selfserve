import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';
import { Toast, ToastService } from './toast.service';

@Component({
  imports: [TPipe],
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack" role="region" [attr.aria-label]="'toast.region' | t">
      @for (t of toasts(); track t.id) {
        <div
          class="toast"
          [attr.data-tone]="t.tone"
          [class.is-leaving]="t.leaving"
          [attr.role]="t.tone === 'error' ? 'alert' : 'status'"
          (mouseenter)="toastSvc.pause(t.id)"
          (mouseleave)="toastSvc.resume(t.id)"
          (focusin)="toastSvc.pause(t.id)"
          (focusout)="toastSvc.resume(t.id)"
          (keydown.escape)="toastSvc.dismiss(t.id)"
        >
          <span class="icon" aria-hidden="true">
            @switch (t.tone) {
              @case ('success') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.7" />
                  <path d="M7.5 12.5L11 16L16.5 9.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              }
              @case ('error') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.7" />
                  <path d="M12 7v6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                  <circle cx="12" cy="16.5" r="1" fill="currentColor" />
                </svg>
              }
              @default {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.7" />
                  <circle cx="12" cy="8" r="1" fill="currentColor" />
                  <path d="M12 11v6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
                </svg>
              }
            }
          </span>
          <span class="msg">{{ t.message }}</span>
          @if (t.action; as a) {
            <button type="button" class="action" (click)="run(t, a.run)">{{ a.label }}</button>
          }
          <button type="button" class="close" (click)="toastSvc.dismiss(t.id)" [attr.aria-label]="'common.dismiss' | t">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .stack {
        position: fixed; left: 50%; transform: translateX(-50%);
        top: calc(env(safe-area-inset-top) + var(--space-3));
        z-index: var(--z-toast);
        display: flex; flex-direction: column; gap: var(--space-2);
        width: min(440px, calc(100vw - var(--space-6)));
        pointer-events: none;
      }
      /* A solid pill in the tone's colour, white text, that slides and fades in and out. */
      .toast {
        --fill: var(--toast-info);
        pointer-events: auto;
        display: flex; align-items: center; gap: var(--space-3);
        padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
        min-height: 52px;
        border-radius: var(--radius-pill);
        background: var(--fill); color: var(--on-dark);
        box-shadow: var(--shadow-3);
        animation: toast-in var(--dur-slow) var(--ease-out) both;
      }
      .toast.is-leaving { animation: toast-out 180ms ease-in both; }
      .toast[data-tone='success'] { --fill: var(--toast-success); }
      .toast[data-tone='error'] { --fill: var(--toast-error); }
      .icon { flex: none; display: inline-flex; color: var(--on-dark); }
      .msg { flex: 1; min-width: 0; font-size: var(--fs-md); font-weight: var(--fw-medium); line-height: 1.35; overflow-wrap: anywhere; }
      .action {
        flex: none; min-height: var(--tap-min); padding: 0 var(--space-3); border: 0; border-radius: var(--radius-pill);
        background: transparent; color: var(--on-dark); font: var(--fw-bold) var(--fs-md) var(--font-sans);
        text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
      }
      .action:hover, .close:hover { background: rgba(255, 255, 255, 0.16); }
      .close {
        flex: none; display: inline-flex; align-items: center; justify-content: center;
        width: var(--tap-min); height: var(--tap-min); border: 0; border-radius: 50%;
        background: transparent; color: var(--on-dark-soft); cursor: pointer;
      }
      .action:focus-visible, .close:focus-visible { outline: 2px solid var(--on-dark); outline-offset: -2px; }
      @keyframes toast-in {
        from { opacity: 0; transform: translateY(-14px) scale(0.94); }
        to { opacity: 1; transform: none; }
      }
      @keyframes toast-out {
        from { opacity: 1; transform: none; }
        to { opacity: 0; transform: translateY(-10px) scale(0.96); }
      }
      @media (prefers-reduced-motion: reduce) { .toast, .toast.is-leaving { animation: none; } }
    `,
  ],
})
export class ToastHostComponent {
  protected readonly toastSvc = inject(ToastService);
  readonly toasts = this.toastSvc.toasts;

  /** Runs the toast's action, then closes it: the follow-up has been taken. */
  protected run(toast: Toast, action: () => void): void {
    this.toastSvc.dismiss(toast.id);
    action();
  }
}
