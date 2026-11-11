import { IconComponent } from '../../../shared/icon.component';
import { ModalComponent } from '../../../shared/modal.component';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MaskedContact, OtpDestination } from '../../../core/api/api-client';
import { normalizePhoneNg } from '../../../core/api/contact.util';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * "Where should we send your code?" The phones and emails tied to the BVN are shown in part. A customer who can
 * reach none of them can give another phone number instead; the code then proves they hold that number, so the
 * back office decides what extra check, if any, such an application needs.
 */
@Component({
  selector: 'app-otp-channel-dialog',
  imports: [IconComponent, ModalComponent, TPipe, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="true" [title]="'otp.where.title' | t" (closed)="cancelled.emit()">
      <div class="panel">
        <h2 class="title">{{ 'otp.where.title' | t }}</h2>

        @if (!alternate()) {
          <p class="sub">{{ 'otp.where.sub' | t }}</p>
          <div class="options" role="radiogroup" [attr.aria-label]="'otp.where.title' | t">
            @for (c of phones(); track c.id) {
              <button type="button" role="radio" class="option" [attr.aria-checked]="selected() === c.id" (click)="pick(c.id)" [disabled]="busy()">
                <app-icon name="bold-call" [size]="20" />
                <span class="option-text"><span class="kind">{{ 'otp.phone' | t }}</span><span class="value">{{ c.masked }}</span></span>
                <span class="mark" aria-hidden="true"></span>
              </button>
            }
            @for (c of emails(); track c.id) {
              <button type="button" role="radio" class="option" [attr.aria-checked]="selected() === c.id" (click)="pick(c.id)" [disabled]="busy()">
                <app-icon name="bold-message" [size]="20" />
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
          <input id="alt-phone" class="input" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 000 0000" [formControl]="altPhone" [attr.aria-invalid]="showInvalid()" aria-describedby="alt-hint" />
          @if (showInvalid()) {
            <p class="error" role="alert">{{ 'otp.alt.invalid' | t }}</p>
          }
          <p class="hint" id="alt-hint">{{ 'otp.alt.hint' | t }}</p>
          @if (hasContacts()) {
            <button type="button" class="link" (click)="alternate.set(false)">{{ 'otp.alt.back' | t }}</button>
          }
        }

        <div class="actions">
          @if (alternate()) {
            <button type="button" class="cta" [disabled]="busy()" (click)="send()">{{ 'otp.send' | t }}</button>
          }
        </div>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .panel { display: flex; flex-direction: column; gap: var(--space-3); }
      .title { margin: 0; font-family: var(--font-display); font-size: var(--fs-xl); font-weight: 600; }
      .sub, .hint { margin: 0; font-size: var(--fs-md); line-height: 1.5; color: var(--ink-soft); }
      .hint { font-size: var(--fs-sm); color: var(--ink-muted); }
      .options { display: flex; flex-direction: column; gap: var(--space-2); }
      .option {
        display: flex; align-items: center; gap: var(--space-3); width: 100%; min-height: 60px; padding: var(--space-3) var(--space-4);
        border: 2px solid transparent; border-radius: var(--radius-md); background: var(--grey-100); color: var(--ink);
        font: inherit; text-align: left; cursor: pointer;
      }
      @media (hover: hover) and (pointer: fine) { .option:hover { background: var(--grey-200); } }
      .option[aria-checked='true'] { border-color: var(--action-primary); background: var(--action-primary-soft); }
      .option:focus-visible, .link:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
      .option-text { flex: 1; display: flex; flex-direction: column; }
      .kind { font-size: var(--fs-xs); color: var(--ink-muted); }
      .value { font-size: var(--fs-base); font-weight: 600; font-variant-numeric: tabular-nums; }
      .mark { flex: none; width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--input-border); }
      .option[aria-checked='true'] .mark { border-color: var(--action-primary); background: radial-gradient(circle, var(--action-primary) 50%, transparent 55%); }
      .link { align-self: flex-start; min-height: var(--tap-min); padding: 0; border: 0; background: none; color: var(--text-accent); font: inherit; font-weight: var(--fw-medium); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
      .label { font-size: var(--fs-sm); font-weight: 500; }
      .input {
        width: 100%; min-height: var(--input-height); padding: 0 var(--space-4); background: var(--input-bg);
        border: 1px solid var(--input-border); border-radius: var(--input-radius); font: inherit; font-size: var(--fs-base); color: var(--ink);
      }
      .input:focus-visible { outline: 2px solid transparent; border-color: var(--input-border-focus); box-shadow: var(--input-shadow-focus); }
      .input[aria-invalid='true'] { border-color: var(--danger-text); }
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

  /** Tapping a contact sends the code to it straight away: no second "Send code" tap. */
  protected pick(id: string): void {
    if (this.busy()) return;
    this.selected.set(id);
    this.confirmed.emit({ kind: 'bvn-contact', id });
  }

  protected send(): void {
    if (this.alternate()) {
      this.attempted.set(true);
      const phone = normalizePhoneNg(this.altPhone.value);
      if (phone) this.confirmed.emit({ kind: 'alternate-phone', phone });
      return;
    }
  }
}
