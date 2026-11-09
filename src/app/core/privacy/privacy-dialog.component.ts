import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';
import { PrivacyService } from './privacy.service';
import { SUPPORT_EMAIL, telLink, whatsappLink } from '../support';

/**
 * Plain-language privacy notice in a native dialog: it stays on the page (so a half-filled
 * form is never lost), is translated, traps focus and closes with Escape.
 * Needs review by Legal/Compliance before launch.
 */
@Component({
  selector: 'app-privacy-dialog',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="dlg" aria-labelledby="privacy-title" (close)="privacy.close()" (click)="onBackdrop($event)">
      <div class="body">
        <h2 id="privacy-title" class="title">{{ 'privacy.title' | t }}</h2>
        <p class="intro">{{ 'privacy.intro' | t }}</p>
        @for (s of sections; track s) {
          <section class="sec">
            <h3>{{ 'privacy.' + s + '.title' | t }}</h3>
            <p>{{ 'privacy.' + s + '.body' | t }}</p>
          </section>
        }
        <p class="contact">
          <a [attr.href]="whatsapp" target="_blank" rel="noopener">WhatsApp</a> ·
          <a [attr.href]="tel">{{ 'step.eligibility.declined.call' | t }}</a> ·
          <a [attr.href]="'mailto:' + email">{{ email }}</a>
        </p>
        <button type="button" class="close" (click)="privacy.close()">{{ 'privacy.back' | t }}</button>
      </div>
    </dialog>
  `,
  styles: [
    `
      .dlg {
        width: min(520px, calc(100vw - 24px)); max-height: calc(100dvh - 24px);
        padding: 0; border: 0; border-radius: var(--radius-lg);
        background: var(--surface-0); color: var(--ink); box-shadow: var(--shadow-4);
      }
      .dlg::backdrop { background: rgba(7, 30, 61, 0.5); }
      .body { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); overflow-y: auto; max-height: calc(100dvh - 24px); }
      .title { margin: 0; font-size: 24px; }
      .intro { margin: 0; color: var(--ink-soft); line-height: 1.5; }
      .sec h3 { margin: 0 0 4px; font-size: 16px; }
      .sec p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--ink-soft); }
      .contact { margin: 0; font-size: 14px; }
      .contact a { color: var(--action-primary); font-weight: 600; text-underline-offset: 3px; }
      .close {
        align-self: stretch; min-height: 52px; border: 0; border-radius: var(--radius-pill);
        background: var(--action-primary); color: var(--action-on-primary); font: inherit; font-weight: 500; cursor: pointer;
      }
      .close:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--focus-ring); }
    `,
  ],
})
export class PrivacyDialogComponent {
  protected readonly privacy = inject(PrivacyService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly sections = ['collect', 'use', 'share', 'keep', 'rights'];
  readonly whatsapp = whatsappLink('Hello Princeps, I have a question about my data.');
  readonly tel = telLink();
  readonly email = SUPPORT_EMAIL;

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.privacy.isOpen() && !el.open) el.showModal?.();
      if (!this.privacy.isOpen() && el.open) el.close();
    });
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === this.dlg().nativeElement) this.privacy.close();
  }
}
