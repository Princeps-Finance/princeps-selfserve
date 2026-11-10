import { ModalComponent } from '../../shared/modal.component';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TPipe } from '../../core/i18n/t.pipe';
import { APP_VERSION } from '../../core/app-version';
import { Router } from '@angular/router';
import { SUPPORT_EMAIL, SUPPORT_PHONE, ZOHO_CHAT_SCRIPT_URL, telLink, whatsappLink } from '../../core/support';
import { LiveChatService, chatAllowedOn } from '../../core/support-chat/live-chat.service';

/**
 * Help lives in the top bar as a "?" button (not a floating button that covers content as
 * you scroll). It opens a bottom sheet with the three ways to reach a person.
 */
@Component({
  selector: 'app-help-launcher',
  imports: [ModalComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="help-btn glass-pill"
      (click)="toggle()"
      [attr.aria-expanded]="open()"
      aria-haspopup="dialog"
      [attr.aria-label]="'help.open' | t"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8" />
        <circle cx="12" cy="17" r="0.6" fill="currentColor" />
      </svg>
      <span>{{ 'support.label' | t }}</span>
    </button>

    <app-modal [open]="open()" [title]="'help.dialog' | t" (closed)="open.set(false)">
        <p class="sheet-title">{{ 'help.title' | t }}</p>
        <p class="sheet-sub">{{ 'help.sub' | t }}</p>
        @if (chatAvailable()) {
          <button type="button" class="row row-btn" (click)="startChat()">
            <span class="row-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>
            </span>
            <span>{{ 'help.chat' | t }}</span>
          </button>
        }
        <a class="row" [attr.href]="wa" target="_blank" rel="noopener">
          <span class="row-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2zm5.5 14.3c-.2.6-1.3 1.2-1.8 1.3-.5.1-1.1.1-1.7-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.4-5.1-4.6-.1-.2-1.2-1.6-1.2-3s.8-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.2.6.7 2 .8 2.1.1.1.1.3 0 .5s-.1.3-.3.5-.3.4-.5.6c-.1.1-.3.3-.1.6.2.3.9 1.5 2 2.4 1.4 1.2 2.6 1.6 2.9 1.7.3.2.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.7-.2.3.1 1.9.9 2.2 1 .3.2.6.2.6.4.1.1.1.9-.1 1.5z"/></svg>
          </span>
          <span>WhatsApp</span>
        </a>
        <a class="row" [attr.href]="tel">
          <span class="row-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h3l2 4-2 1a10 10 0 0 0 4 4l1-2 4 2v3a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 1-2z"/></svg>
          </span>
          <span>{{ 'help.call' | t: { tel: phone } }}</span>
        </a>
        <a class="row" [attr.href]="'mailto:' + email + '?subject=Loan%20application%20help'">
          <span class="row-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18v12H3z"/><path d="M3 6l9 7 9-7"/></svg>
          </span>
          <span>{{ 'help.email' | t }}</span>
        </a>
        <p class="sheet-version">{{ 'help.version' | t: { v: version } }}</p>
    </app-modal>
  `,
  styles: [
    `
      :host { position: fixed; right: calc(var(--space-4) + env(safe-area-inset-right)); bottom: calc(var(--space-4) + env(safe-area-inset-bottom)); z-index: 60; }
      .help-btn { font: var(--btn-weight) 15px/1 var(--font-sans); }
      .sheet-title { margin: 0; font-family: var(--font-display); font-size: 20px; font-weight: 600; }
      .sheet-sub { margin: 0 0 var(--space-2); font-size: var(--fs-md); color: var(--ink-soft); }
      .row {
        display: flex; align-items: center; gap: var(--space-3); min-height: 52px; padding: 0 var(--space-3);
        border-radius: var(--radius-md); color: var(--ink); text-decoration: none; font-weight: 500;
      }
      .row-btn { width: 100%; border: 0; background: none; font: inherit; font-weight: 500; text-align: left; cursor: pointer; }
      .row:hover { background: var(--surface-2); }
      .row:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--focus-ring); }
      .row-icon { display: inline-flex; width: 32px; height: 32px; border-radius: 50%; align-items: center; justify-content: center; background: var(--grey-100); color: var(--ink); }
      .sheet-version { margin: var(--space-2) 0 0; font-size: var(--fs-xs); color: var(--ink-muted); }
      @media (prefers-reduced-motion: reduce) { .help-btn { transition: none; } }
    `,
  ],
})
export class HelpLauncherComponent {
  private readonly router = inject(Router);
  private readonly chat = inject(LiveChatService);

  readonly open = signal(false);
  readonly tel = telLink();
  readonly phone = SUPPORT_PHONE;
  readonly email = SUPPORT_EMAIL;
  readonly wa = whatsappLink();
  readonly version = APP_VERSION;

  /** Live chat is one option in the sheet, next to WhatsApp, call and email. It is left out where it must not start. */
  protected chatAvailable(): boolean {
    return !!ZOHO_CHAT_SCRIPT_URL && chatAllowedOn(this.router.url);
  }

  toggle(): void {
    this.open.update((v) => !v);
  }

  protected async startChat(): Promise<void> {
    if (await this.chat.open()) this.open.set(false);
  }
}
