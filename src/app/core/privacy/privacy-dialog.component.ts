import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ModalComponent } from '../../shared/modal.component';
import { TPipe } from '../i18n/t.pipe';
import { PrivacyService } from './privacy.service';
import { SUPPORT_EMAIL, telLink, whatsappLink } from '../support';

/**
 * Plain-language privacy notice in the shared modal: it stays on the page (so a half-filled
 * form is never lost), is translated, traps focus and closes with Escape or Back.
 * Needs review by Legal/Compliance before launch.
 */
@Component({
  selector: 'app-privacy-dialog',
  imports: [ModalComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="privacy.isOpen()" [title]="'privacy.title' | t" (closed)="privacy.close()">
      <div class="body">
        <h2 class="title">{{ 'privacy.title' | t }}</h2>
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
      </div>
    </app-modal>
  `,
  styles: [
    `
      .body { display: flex; flex-direction: column; gap: var(--space-4); }
      .title { margin: 0; font-size: 24px; }
      .intro { margin: 0; color: var(--ink-soft); line-height: 1.5; }
      .sec h3 { margin: 0 0 var(--space-1); font-size: var(--fs-base); }
      .sec p { margin: 0; font-size: var(--fs-body); line-height: 1.5; color: var(--ink-soft); }
      .contact { margin: 0; font-size: var(--fs-md); }
      .contact a { color: var(--text-accent); font-weight: 600; text-underline-offset: 3px; }
    `,
  ],
})
export class PrivacyDialogComponent {
  protected readonly privacy = inject(PrivacyService);

  readonly sections = ['collect', 'use', 'share', 'keep', 'rights'];
  readonly whatsapp = whatsappLink('Hello Princeps, I have a question about my data.');
  readonly tel = telLink();
  readonly email = SUPPORT_EMAIL;
}
