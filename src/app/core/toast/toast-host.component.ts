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
      .toast {
        --tone: var(--info);
        --tone-bg: var(--info-soft);
        pointer-events: auto;
        display: flex; align-items: center; gap: var(--space-3);
        padding: var(--space-3) var(--space-2) var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--tone-bg); /* solid fallback; frosted below where supported */
        color: var(--ink);
        border: 1px solid color-mix(in srgb, var(--tone) 35%, transparent);
        box-shadow: var(--shadow-3);
        animation: toast-in var(--dur-slow) var(--ease-out) both;
      }
      @supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
        @media (prefers-reduced-transparency: no-preference) {
          .toast {
            background: color-mix(in srgb, var(--tone-bg) 84%, transparent);
            -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(160%); backdrop-filter: blur(var(--glass-blur)) saturate(160%);
          }
        }
      }
      .toast[data-tone='success'] { --tone: var(--success); --tone-bg: var(--success-soft); }
      .toast[data-tone='error'] { --tone: var(--danger); --tone-bg: var(--danger-soft); }
      .icon { flex: none; display: inline-flex; color: var(--tone); }
      .msg { flex: 1; min-width: 0; font-size: var(--fs-md); line-height: 1.4; color: var(--ink); overflow-wrap: anywhere; }
      .action {
        flex: none; min-height: var(--tap-min); padding: 0 var(--space-3); border: 0; border-radius: var(--radius-sm);
        background: transparent; color: var(--ink); font: var(--fw-bold) var(--fs-md) var(--font-sans);
        text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
      }
      .action:hover { background: var(--hover-tint); }
      .close {
        flex: none; display: inline-flex; align-items: center; justify-content: center;
        width: var(--tap-min); height: var(--tap-min); border: 0; border-radius: var(--radius-sm);
        background: transparent; color: var(--ink-soft); cursor: pointer;
      }
      .close:hover { background: var(--hover-tint); color: var(--ink); }
      .action:focus-visible, .close:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
      @keyframes toast-in {
        from { opacity: 0; transform: translateY(-8px) scale(0.98); }
        to { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
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
