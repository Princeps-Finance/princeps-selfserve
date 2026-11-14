import { ButtonDirective } from '../../shared/components/button/button.directive';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { TPipe } from '../i18n/t.pipe';
import { PrivacyService } from './privacy.service';
import { SUPPORT_EMAIL, telLink, whatsappLink } from '../support';

/**
 * Plain-language privacy notice in a shared dialog: it stays on the page (so a half-filled
 * form is never lost), is translated, traps focus and closes with Escape.
 * Needs review by Legal/Compliance before launch.
 */
@Component({
  selector: 'app-privacy-dialog',
  imports: [ButtonDirective, TPipe, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [open]="privacy.isOpen()" [title]="'privacy.title' | t" [showClose]="false" (closed)="privacy.close()">
      <ng-template>
        <div class="body">
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
          <button type="button" appButton variant="primary" (click)="privacy.close()">{{ 'privacy.back' | t }}</button>
        </div>
      </ng-template>
    </app-dialog>
  `,
  styles: [
    `
      .body { display: flex; flex-direction: column; gap: var(--space-4); }
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
