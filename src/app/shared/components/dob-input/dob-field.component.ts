import { InputDirective } from '../input/input.directive';
import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LangService } from '../../../core/i18n/lang.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { SelectFieldComponent } from '../select/select-field.component';
import type { SelectOption } from '../select/select-option';

/** Returns an ISO date (YYYY-MM-DD) for a real calendar date, otherwise ''. */
export function toIsoDate(day: string, month: string, year: string): string {
  const dayNumber = Number(day), monthNumber = Number(month), yearNumber = Number(year);
  if (!day || !month || year.length !== 4 || !Number.isInteger(dayNumber) || !Number.isInteger(monthNumber) || !Number.isInteger(yearNumber)) return '';
  const date = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));
  if (date.getUTCFullYear() !== yearNumber || date.getUTCMonth() !== monthNumber - 1 || date.getUTCDate() !== dayNumber) return '';
  if (yearNumber < 1900 || date.getTime() > Date.now()) return '';
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
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
    return Array.from({ length: 12 }, (_unused, monthIndex) => ({ value: String(monthIndex + 1), label: fmt.format(new Date(Date.UTC(2000, monthIndex, 1))) }));
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
    this.year.set(dateParts ? dateParts[1] : '');
    this.month.set(dateParts ? String(Number(dateParts[2])) : '');
    this.day.set(dateParts ? String(Number(dateParts[3])) : '');
  }
  registerOnChange(callback: (value: string) => void): void { this.onChange = callback; }
  registerOnTouched(callback: () => void): void { this.onTouched = callback; }

  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }

  protected touch(): void { this.onTouched(); }

  protected setDay(value: string): void { this.day.set(value.replace(/\D/g, '').slice(0, 2)); this.emit(); }
  protected setYear(value: string): void { this.year.set(value.replace(/\D/g, '').slice(0, 4)); this.emit(); }
  protected setMonth(value: string): void { this.month.set(value); this.emit(); }

  private emit(): void { this.onChange(toIsoDate(this.day(), this.month(), this.year())); }
}
