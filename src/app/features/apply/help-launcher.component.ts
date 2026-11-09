import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TPipe } from '../../core/i18n/t.pipe';
import { APP_VERSION } from '../../core/app-version';

const SUPPORT_PHONE = '+2348001234567';
const SUPPORT_WHATSAPP = '2348001234567';

@Component({
  selector: 'app-help-launcher',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="launcher">
      @if (open()) {
        <div class="panel" role="dialog" [attr.aria-label]="'help.dialog' | t">
          <p class="panel-title">{{ 'help.title' | t }}</p>
          <p class="panel-sub">{{ 'help.sub' | t }}</p>
          <a class="row" [attr.href]="'https://wa.me/' + wa" target="_blank" rel="noopener">
            <span class="row-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2zm5.5 14.3c-.2.6-1.3 1.2-1.8 1.3-.5.1-1.1.1-1.7-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.4-5.1-4.6-.1-.2-1.2-1.6-1.2-3s.8-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.2.6.7 2 .8 2.1.1.1.1.3 0 .5s-.1.3-.3.5-.3.4-.5.6c-.1.1-.3.3-.1.6.2.3.9 1.5 2 2.4 1.4 1.2 2.6 1.6 2.9 1.7.3.2.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.7-.2.3.1 1.9.9 2.2 1 .3.2.6.2.6.4.1.1.1.9-.1 1.5z"/>
              </svg>
            </span>
            <span>WhatsApp</span>
          </a>
          <a class="row" [attr.href]="'tel:' + tel">
            <span class="row-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h3l2 4-2 1a10 10 0 0 0 4 4l1-2 4 2v3a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 1-2z"/>
              </svg>
            </span>
            <span>{{ 'help.call' | t: { tel: tel } }}</span>
          </a>
          <a class="row" href="mailto:support@princeps.ng?subject=Loan%20application%20help">
            <span class="row-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18v12H3z"/>
                <path d="M3 6l9 7 9-7"/>
              </svg>
            </span>
            <span>{{ 'help.email' | t }}</span>
          </a>
          <p class="panel-version">{{ 'help.version' | t: { v: version } }}</p>
        </div>
      }

      <button
        type="button"
        class="fab"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="'help.open' | t"
      >
        @if (open()) {
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18"/>
          </svg>
        } @else {
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        }
      </button>
    </div>
  `,
  styles: [
    `
      .launcher {
        position: fixed;
        right: calc(var(--space-6) + env(safe-area-inset-right));
        bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
        z-index: 60;
        display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-3);
      }
      .fab {
        width: 56px; height: 56px;
        border-radius: 50%;
        border: none;
        background: var(--action-primary);
        color: var(--action-on-primary);
        display: inline-flex; align-items: center; justify-content: center;
        cursor: pointer;
        box-shadow: 0 12px 28px -12px rgba(11, 46, 91, 0.55);
        transition: transform 160ms cubic-bezier(0.2,0.7,0.1,1), background 160ms ease;
      }
      .fab:hover { background: var(--action-primary-hover); transform: translateY(-1px); }
      .fab:active { transform: scale(0.96); }
      .fab:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: 0 12px 28px -12px rgba(11, 46, 91, 0.55), var(--focus-ring); }

      .panel {
        width: 260px;
        background: rgba(255,255,255,0.92);
        backdrop-filter: blur(14px) saturate(160%);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        box-shadow: 0 20px 60px -20px rgba(11, 46, 91, 0.35);
        display: flex; flex-direction: column; gap: 4px;
        transform-origin: bottom right;
        animation: panel-in 180ms cubic-bezier(0.2, 0.7, 0.1, 1) both;
      }
      @keyframes panel-in {
        from { opacity: 0; transform: scale(0.94) translateY(4px); }
        to   { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .panel { animation: none; }
      }
      .panel-title { margin: 0 0 2px; font-family: var(--font-display); font-weight: 600; font-size: 15px; color: var(--ink); }
      .panel-version { margin: var(--space-2) 0 0; font-size: 12px; color: var(--ink-muted); }
      .panel-sub { margin: 0 0 var(--space-2); font-size: 13px; color: var(--ink-muted); }
      .row {
        display: inline-flex; align-items: center; gap: var(--space-3);
        min-height: 40px; padding: 0 var(--space-3);
        color: var(--ink); background: transparent;
        border: none; border-radius: var(--radius-md);
        font-family: var(--font-sans); font-size: 14px; text-decoration: none; text-align: left;
        cursor: pointer;
        transition: background 140ms ease;
      }
      .row:hover { background: rgba(11, 46, 91, 0.06); }
      .row-icon {
        width: 28px; height: 28px; border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        background: rgba(11, 46, 91, 0.08);
        color: var(--action-primary);
      }
    `,
  ],
})
export class HelpLauncherComponent {
  readonly open = signal(false);
  readonly tel = SUPPORT_PHONE;
  readonly wa = SUPPORT_WHATSAPP;
  readonly version = APP_VERSION;

  toggle(): void {
    this.open.update((v) => !v);
  }
}
