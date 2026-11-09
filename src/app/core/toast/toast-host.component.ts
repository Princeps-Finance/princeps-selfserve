import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack" role="region" aria-label="Notifications" aria-live="polite">
      @for (t of toasts(); track t.id) {
        <output class="toast" [attr.data-tone]="t.tone" role="status">
          <span class="icon" aria-hidden="true">
            @switch (t.tone) {
              @case ('success') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/>
                  <path d="M7.5 12.5L11 16L16.5 9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              }
              @case ('error') {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/>
                  <path d="M12 7v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  <circle cx="12" cy="16.5" r="1" fill="currentColor"/>
                </svg>
              }
              @default {
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/>
                  <circle cx="12" cy="8" r="1" fill="currentColor"/>
                  <path d="M12 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              }
            }
          </span>
          <span class="msg">{{ t.message }}</span>
          <button type="button" class="close" (click)="toastSvc.dismiss(t.id)" aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </output>
      }
    </div>
  `,
  styles: [
    `
      .stack {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        top: calc(env(safe-area-inset-top) + 12px);
        z-index: 1000;
        display: flex; flex-direction: column; gap: 8px;
        width: min(520px, calc(100vw - 24px));
        pointer-events: none;
      }
      .toast {
        pointer-events: auto;
        display: flex; align-items: flex-start; gap: 10px;
        padding: 12px 12px 12px 14px;
        border-radius: 12px;
        background: var(--surface, #ffffff);
        color: var(--ink);
        border: 1px solid var(--hairline);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
        animation: slide-in 220ms cubic-bezier(0.2, 0.7, 0.1, 1);
      }
      .toast[data-tone='success'] { border-color: color-mix(in srgb, var(--success, #10b981) 40%, transparent); }
      .toast[data-tone='success'] .icon { color: var(--success, #10b981); }
      .toast[data-tone='error']   { border-color: color-mix(in srgb, var(--danger, #dc2626) 40%, transparent); }
      .toast[data-tone='error']   .icon { color: var(--danger, #dc2626); }
      .toast[data-tone='info']    .icon { color: var(--action-primary); }
      .icon { flex: none; display: inline-flex; margin-top: 1px; }
      .msg { flex: 1; font-size: 14px; line-height: 1.45; color: var(--ink); }
      .close {
        flex: none;
        display: inline-flex; align-items: center; justify-content: center;
        width: 24px; height: 24px;
        background: transparent; border: none;
        color: var(--ink-muted);
        cursor: pointer; border-radius: 6px;
      }
      .close:hover { background: rgba(17,17,17,0.06); color: var(--ink); }
      .close:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--focus-ring); }
      @keyframes slide-in {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .toast { animation: none; }
      }
      @media (max-width: 380px) {
        .msg { font-size: 13px; }
      }
    `,
  ],
})
export class ToastHostComponent {
  readonly toastSvc = inject(ToastService);
  readonly toasts = this.toastSvc.toasts;
}
