import {
  ChangeDetectionStrategy, Component, ElementRef, forwardRef, input, output, signal, viewChildren,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TPipe } from '../../../core/i18n/t.pipe';

export const OTP_LENGTH = 6;

@Component({
  selector: 'app-otp-input',
  imports: [TPipe],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OtpInputComponent), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './otp-input.component.html',
  styleUrl: './otp-input.component.css',
})
export class OtpInputComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly invalid = input(false);
  readonly incomplete = input(false);
  readonly readOnly = input(false);
  readonly edited = output<void>();

  protected readonly cells = signal<string[]>(this.split(''));
  protected readonly disabled = signal(false);
  private readonly cellRefs = viewChildren<ElementRef<HTMLInputElement>>('cell');

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const cells = this.split(value ?? '');
    this.cells.set(cells);
    this.cellRefs().forEach((cell, index) => (cell.nativeElement.value = cells[index]));
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }

  focusFirstEmpty(): void {
    const firstEmpty = this.cells().indexOf('');
    this.focus(firstEmpty < 0 ? 0 : firstEmpty);
  }

  protected onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    if (digits.length > 1) {
      this.fill(digits);
      return;
    }
    input.value = digits;
    this.cells.update((cells) => cells.map((cell, i) => i === index ? digits : cell));
    if (digits && index < OTP_LENGTH - 1) this.focus(index + 1);
    this.emitEdit();
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    const previous = event.key === 'ArrowLeft' || (event.key === 'Backspace' && !this.cells()[index]);
    if (previous && index > 0) {
      event.preventDefault();
      this.focus(index - 1);
    } else if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      this.focus(index + 1);
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    if (this.readOnly() || this.disabled()) return;
    const digits = event.clipboardData?.getData('text').replace(/\D/g, '');
    if (digits) this.fill(digits);
  }

  protected onFocusOut(event: FocusEvent): void {
    const group = event.currentTarget as HTMLElement;
    if (!this.disabled() && !group.contains(event.relatedTarget as Node | null)) this.onTouched();
  }

  private split(value: string): string[] {
    const digits = value.replace(/\D/g, '');
    return Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] ?? '');
  }

  private focus(index: number): void {
    this.cellRefs()[index]?.nativeElement.focus();
  }

  private fill(digits: string): void {
    this.writeValue(digits);
    this.focus(Math.min(digits.length, OTP_LENGTH - 1));
    this.emitEdit();
  }

  private emitEdit(): void {
    this.onChange(this.cells().join(''));
    this.edited.emit();
  }
}
