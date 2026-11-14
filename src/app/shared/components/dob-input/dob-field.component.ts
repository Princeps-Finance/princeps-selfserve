import { InputDirective } from '../input/input.directive';
import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LangService } from '../../../core/i18n/lang.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { SelectFieldComponent } from '../select/select-field.component';
import type { SelectOption } from '../select/select-option';

/** Returns an ISO date (YYYY-MM-DD) for a real calendar date, otherwise ''. */
export function toIsoDate(day: string, month: string, year: string): string {
  const d = Number(day), m = Number(month), y = Number(year);
  if (!day || !month || year.length !== 4 || !Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
  if (y < 1900 || dt.getTime() > Date.now()) return '';
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Date of birth as Day / Month / Year. Typed day and year (numeric keypad on phones) and a
 * custom month list, instead of the browser calendar, which needs many taps to reach a birth year.
 */
@Component({
  selector: 'app-dob-field',
  imports: [InputDirective, TPipe, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DobFieldComponent), multi: true }],
  template: `
    <div class="row" role="group" [attr.aria-labelledby]="labelId()">
      <div class="cell day">
        <label class="sub" [for]="inputId() + '-d'">{{ 'date.day' | t }}</label>
        <input appInput
          [id]="inputId() + '-d'" class="input" type="text" inputmode="numeric" maxlength="2"
          autocomplete="bday-day" placeholder="DD"
          [disabled]="disabled()" [attr.aria-invalid]="invalid() ? true : null"
          [value]="day()" (input)="setDay($any($event.target).value)" (blur)="touch()"
        />
      </div>
      <div class="cell month">
        <label class="sub" [for]="inputId() + '-m'">{{ 'date.month' | t }}</label>
        <app-select-field
          [inputId]="inputId() + '-m'" [options]="months()" [title]="'date.month' | t" [placeholder]="'date.month' | t"
          [invalid]="invalid()" [isDisabled]="disabled()" [value]="month()" (valueChange)="setMonth($event)"
        />
      </div>
      <div class="cell year">
        <label class="sub" [for]="inputId() + '-y'">{{ 'date.year' | t }}</label>
        <input appInput
          [id]="inputId() + '-y'" class="input" type="text" inputmode="numeric" maxlength="4"
          autocomplete="bday-year" placeholder="YYYY"
          [disabled]="disabled()" [attr.aria-invalid]="invalid() ? true : null"
          [value]="year()" (input)="setYear($any($event.target).value)" (blur)="touch()"
        />
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .row { display: grid; grid-template-columns: 0.8fr 1.6fr 1fr; gap: var(--space-3); align-items: end; }
      .cell { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
      .sub { font-size: var(--fs-xs); color: var(--ink-soft); }
    `,
  ],
})
export class DobFieldComponent implements ControlValueAccessor {
  private readonly lang = inject(LangService);

  readonly inputId = input<string>('dob');
  readonly labelId = input<string>('');
  readonly invalid = input<boolean | null>(null);

  protected readonly disabled = signal(false);
  protected readonly day = signal('');
  protected readonly month = signal('');
  protected readonly year = signal('');

  protected readonly months = computed<SelectOption[]>(() => {
    const code = this.lang.lang();
    let fmt: Intl.DateTimeFormat;
    try { fmt = new Intl.DateTimeFormat(code, { month: 'long', timeZone: 'UTC' }); }
    catch { fmt = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }); }
    return Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: fmt.format(new Date(Date.UTC(2000, i, 1))) }));
  });

  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(v: string | null): void {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
    this.year.set(m ? m[1] : '');
    this.month.set(m ? String(Number(m[2])) : '');
    this.day.set(m ? String(Number(m[3])) : '');
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }

  protected touch(): void { this.onTouched(); }

  protected setDay(v: string): void { this.day.set(v.replace(/\D/g, '').slice(0, 2)); this.emit(); }
  protected setYear(v: string): void { this.year.set(v.replace(/\D/g, '').slice(0, 4)); this.emit(); }
  protected setMonth(v: string): void { this.month.set(v); this.emit(); }

  private emit(): void { this.onChange(toIsoDate(this.day(), this.month(), this.year())); }
}
