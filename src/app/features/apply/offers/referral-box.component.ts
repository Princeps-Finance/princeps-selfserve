import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { LangService } from '../../../core/i18n/lang.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ReferralLinkService } from '../../../core/referral/referral-link.service';
import { API_CLIENT } from '../../../core/api/api-client';

/** "Have a referral code?" on the offers step. The server re-checks the code; this only previews the discount. */
@Component({
  selector: 'app-referral-box',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="referral">
    @if (referral(); as r) {
      <div class="referral-applied" role="status">
        <div class="referral-applied-main">
          <span class="referral-check" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M5 10.5L8.5 14L15 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <div>
            <div class="referral-code">{{ r.code }}</div>
            <div class="referral-label">{{ r.label }} {{ 'referral.applied' | t }}</div>
          </div>
        </div>
        <button type="button" class="referral-remove" (click)="remove()">{{ 'common.remove' | t }}</button>
      </div>
    } @else {
      @if (!open()) {
        <button type="button" class="referral-toggle" (click)="toggle()">
          <span>{{ 'referral.toggle' | t }}</span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      } @else {
        <div class="referral-form">
          <label class="referral-input-wrap">
            <span class="referral-input-label">{{ 'referral.label' | t }}</span>
            <input
              class="referral-input"
              type="text"
              autocomplete="off"
              autocapitalize="characters"
              [placeholder]="'referral.placeholder' | t"
              [value]="input()"
              (input)="onInput($any($event.target).value.toUpperCase())"
              (keyup.enter)="apply()"
              [attr.aria-label]="'referral.label' | t"
            />
          </label>
          <div class="referral-actions">
            <button type="button" class="referral-cancel" (click)="toggle()">{{ 'common.cancel' | t }}</button>
            <button type="button" class="referral-apply" (click)="apply()" [disabled]="!input().trim() || checking()">{{ 'common.apply' | t }}</button>
          </div>
          @if (error(); as err) {
            <p class="referral-error" role="alert">{{ err }}</p>
          }
        </div>
      }
    }
  </div>

  `,
  styles: [
    `
.referral { display: flex; flex-direction: column; margin-bottom: var(--space-4); }
/* A plain text link with a small arrow showing it opens: not a box with a plus, which looked like an "add" button. */
.referral-toggle {
  align-self: flex-start; display: inline-flex; align-items: center; gap: var(--space-1);
  min-height: var(--tap-min); padding: 0; border: 0; background: none;
  color: var(--ink-soft); font: inherit; font-size: var(--fs-md); text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
}
.referral-toggle:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); border-radius: 4px; }
.referral-form, .referral-applied {
  display: flex; gap: var(--space-2); padding: 14px; border-radius: var(--radius-md);
  background: var(--surface-0); border: 1px solid var(--hairline);
}
.referral-form { flex-direction: column; }
.referral-input-wrap { display: flex; flex-direction: column; gap: var(--space-1); }
.referral-input-label { font-size: var(--fs-xs); color: var(--ink-soft); }
.referral-input {
  height: 44px; padding: 0 var(--space-3); border: 1px solid var(--hairline-strong); border-radius: var(--radius-sm);
  font: inherit;
}
.referral-actions { display: flex; gap: var(--space-2); justify-content: flex-end; }
.referral-cancel, .referral-apply {
  height: 40px; padding: 0 var(--space-4); border-radius: var(--btn-radius); font: var(--btn-weight) 14px var(--font-sans);
  border: 1px solid var(--hairline-strong); background: var(--surface-0); cursor: pointer;
}
.referral-apply { background: var(--action-primary); border-color: var(--action-primary); color: var(--action-on-primary); }
.referral-apply:disabled { opacity: 0.4; cursor: not-allowed; }
.referral-error { font-size: var(--fs-sm); color: var(--danger); }
.referral-applied { align-items: center; justify-content: space-between; background: var(--success-soft); }
.referral-applied-main { display: flex; align-items: center; gap: var(--space-3); }
.referral-check { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--success); color: #fff; }
.referral-code { font: 600 14px var(--font-mono); }
.referral-remove { border: 0; background: none; color: var(--ink-soft); text-decoration: underline; cursor: pointer; }

    `,
  ],
})
export class ReferralBoxComponent implements OnInit {
  private readonly state = inject(ApplicationStateService);
  private readonly lang = inject(LangService);
  private readonly api = inject(API_CLIENT);
  private readonly link = inject(ReferralLinkService);

  protected readonly referral = this.state.referral;
  protected readonly open = signal(false);
  protected readonly input = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly checking = signal(false);

  /** A code that came in with the link is applied here, so the customer is never asked for it. */
  ngOnInit(): void {
    void this.link.applyPending();
  }

  protected toggle(): void {
    this.open.update((v) => !v);
    if (!this.open()) this.error.set(null);
  }

  protected onInput(value: string): void {
    this.input.set(value);
    if (this.error()) this.error.set(null);
  }

  protected async apply(): Promise<void> {
    if (this.checking() || !this.input().trim()) return;
    this.checking.set(true);
    const parsed = await this.api.checkReferral(this.input().trim());
    this.checking.set(false);
    if (!parsed) {
      this.error.set(this.lang.t('referral.invalid'));
      return;
    }
    this.state.setReferral(parsed);
    this.error.set(null);
    this.open.set(false);
  }

  protected remove(): void {
    this.state.setReferral(null);
    this.input.set('');
  }
}
