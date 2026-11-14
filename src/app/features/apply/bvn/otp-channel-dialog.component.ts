import { InputDirective } from '../../../shared/components/input/input.directive';
import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MaskedContact, OtpDestination } from '../../../core/api/api-client';
import { normalizePhoneNg } from '../../../core/api/contact.util';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * "Where should we send your code?" The phones and emails tied to the BVN are shown in part. A customer who can
 * reach none of them can give another phone number instead; the code then proves they hold that number, so the
 * back office decides what extra check, if any, such an application needs.
 */
@Component({
  selector: 'app-otp-channel-dialog',
  imports: [InputDirective, ButtonDirective, TPipe, ReactiveFormsModule, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [open]="true" [title]="'otp.where.title' | t" layout="sheet" dismissal="escape" [showClose]="false" (closed)="cancelled.emit()">
      <ng-template>
        <div class="panel">
          @if (!alternate()) {
            <p class="sub">{{ 'otp.where.sub' | t }}</p>
            <div class="options" role="radiogroup" [attr.aria-label]="'otp.where.title' | t">
              @for (c of phones(); track c.id) {
                <button type="button" role="radio" class="option" [attr.aria-checked]="selected() === c.id" (click)="selected.set(c.id)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h3l2 4-2 1a10 10 0 0 0 4 4l1-2 4 2v3a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 1-2z" /></svg>
                  <span class="option-text"><span class="kind">{{ 'otp.phone' | t }}</span><span class="value">{{ c.masked }}</span></span>
                  <span class="mark" aria-hidden="true"></span>
                </button>
              }
              @for (c of emails(); track c.id) {
                <button type="button" role="radio" class="option" [attr.aria-checked]="selected() === c.id" (click)="selected.set(c.id)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18v12H3z" /><path d="M3 6l9 7 9-7" /></svg>
                  <span class="option-text"><span class="kind">{{ 'otp.email' | t }}</span><span class="value">{{ c.masked }}</span></span>
                  <span class="mark" aria-hidden="true"></span>
                </button>
              }
            </div>
            <button type="button" class="link" (click)="alternate.set(true)">{{ 'otp.where.noaccess' | t }}</button>
          } @else {
            @if (!hasContacts()) {
              <p class="sub">{{ 'otp.where.none' | t }}</p>
            }
            <label class="label" for="alt-phone">{{ 'otp.alt.label' | t }}</label>
            <input appInput id="alt-phone" class="input" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 000 0000" [formControl]="altPhone" [attr.aria-invalid]="showInvalid()" aria-describedby="alt-hint" />
            @if (showInvalid()) {
              <p class="error" role="alert">{{ 'otp.alt.invalid' | t }}</p>
            }
            <p class="hint" id="alt-hint">{{ 'otp.alt.hint' | t }}</p>
            @if (hasContacts()) {
              <button type="button" class="link" (click)="alternate.set(false)">{{ 'otp.alt.back' | t }}</button>
            }
          }

          <div class="actions">
            <button type="button" class="cta" appButton variant="primary" [disabled]="busy() || (!alternate() && !selected())" (click)="send()">{{ 'otp.send' | t }}</button>
            <button type="button" class="alt" appButton variant="secondary" (click)="cancelled.emit()">{{ 'common.cancel' | t }}</button>
          </div>
        </div>
      </ng-template>
    </app-dialog>
  `,
  styles: [
    `
      .panel { display: flex; flex-direction: column; gap: var(--space-3); }
      .sub, .hint { margin: 0; font-size: var(--fs-md); line-height: 1.5; color: var(--ink-soft); }
      .hint { font-size: var(--fs-sm); color: var(--ink-muted); }
      .options { display: flex; flex-direction: column; gap: var(--space-2); }
      .option {
        display: flex; align-items: center; gap: var(--space-3); width: 100%; min-height: 60px; padding: var(--space-3) var(--space-4);
        border: 2px solid transparent; border-radius: var(--radius-md); background: var(--grey-100); color: var(--ink);
        font: inherit; text-align: left; cursor: pointer;
      }
      .option:hover { background: var(--grey-200); }
      .option[aria-checked='true'] { border-color: var(--action-primary); background: var(--action-primary-soft); }
      .option:focus-visible, .link:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
      .option-text { flex: 1; display: flex; flex-direction: column; }
      .kind { font-size: var(--fs-xs); color: var(--ink-muted); }
      .value { font-size: var(--fs-base); font-weight: 600; font-variant-numeric: tabular-nums; }
      .mark { flex: none; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--input-border); }
      .option[aria-checked='true'] .mark { border-color: var(--action-primary); background: radial-gradient(circle, var(--action-primary) 45%, transparent 50%); }
      .link { align-self: flex-start; min-height: var(--tap-min); padding: 0; border: 0; background: none; color: var(--text-accent); font: inherit; font-weight: var(--fw-medium); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
      .label { font-size: var(--fs-sm); font-weight: 500; }
      .error { margin: 0; font-size: var(--fs-sm); color: var(--danger-text); }
      .actions { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2); }
    `,
  ],
})
export class OtpChannelDialogComponent {
  readonly phones = input<MaskedContact[]>([]);
  readonly emails = input<MaskedContact[]>([]);
  readonly busy = input(false);
  readonly confirmed = output<OtpDestination>();
  readonly cancelled = output<void>();

  protected readonly hasContacts = computed(() => this.phones().length + this.emails().length > 0);
  protected readonly selected = signal<string | null>(null);
  /** Showing the "another number" form: chosen by the customer, or forced when nothing is tied to the BVN. */
  private readonly askedForAlternate = signal(false);
  protected readonly alternate = Object.assign(
    computed(() => this.askedForAlternate() || !this.hasContacts()),
    { set: (v: boolean) => this.askedForAlternate.set(v) },
  );
  protected readonly altPhone = new FormControl('', { nonNullable: true });
  private readonly altValue = toSignal(this.altPhone.valueChanges, { initialValue: '' });
  private readonly attempted = signal(false);
  protected readonly showInvalid = computed(() => this.attempted() && !normalizePhoneNg(this.altValue()));

  protected send(): void {
    if (this.alternate()) {
      this.attempted.set(true);
      const phone = normalizePhoneNg(this.altPhone.value);
      if (phone) this.confirmed.emit({ kind: 'alternate-phone', phone });
      return;
    }
    const id = this.selected();
    if (id) this.confirmed.emit({ kind: 'bvn-contact', id });
  }
}
