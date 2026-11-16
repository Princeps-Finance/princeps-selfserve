import { ChangeDetectionStrategy, Component, ElementRef, computed, forwardRef, input, output, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
export const OTP_LENGTH = 6;
@Component({
  selector: 'app-otp-input',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OtpInputComponent), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './otp-input.component.html',
  styleUrl: './otp-input.component.css',
})
export class OtpInputComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);
  readonly incomplete = input(false);
  readonly readOnly = input(false);
  readonly edited = output<void>();
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly focused = signal(false);
  protected readonly cells = computed(() => Array.from({ length: OTP_LENGTH }, (_unused, index) => this.value()[index] ?? ''));
  protected readonly activeIndex = computed(() => Math.min(this.value().length, OTP_LENGTH - 1));
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  writeValue(value: string | null): void {
    const digits = (value ?? '').replace(/\D/g, '').slice(0, OTP_LENGTH);
    this.value.set(digits);
    const field = this.field()?.nativeElement;
    if (field) field.value = digits;
  }
  registerOnChange(callback: (value: string) => void): void { this.onChange = callback; }
  registerOnTouched(callback: () => void): void { this.onTouched = callback; }
  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }
  focusFirstEmpty(): void { this.field()?.nativeElement.focus(); }
  protected onInput(event: Event): void {
    if (this.disabled() || this.readOnly()) return;
    this.writeValue((event.target as HTMLInputElement).value);
    this.onChange(this.value());
    this.edited.emit();
  }
  protected blur(): void { this.focused.set(false); this.onTouched(); }
}
