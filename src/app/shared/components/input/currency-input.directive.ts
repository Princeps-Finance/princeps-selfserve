import { Directive, ElementRef, Renderer2, booleanAttribute, inject, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Directive({
  selector: 'input[appInput][isCurrency]',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: CurrencyInputDirective, multi: true }],
  host: {
    '[attr.inputmode]': 'isCurrency() ? "decimal" : null',
    '(input)': 'updateValue($event)',
    '(blur)': 'onTouched()',
  },
})
export class CurrencyInputDirective implements ControlValueAccessor {
  readonly isCurrency = input(false, { transform: booleanAttribute });
  private readonly element = inject(ElementRef<HTMLInputElement>).nativeElement;
  private readonly renderer = inject(Renderer2);
  private onChange: (value: number | string | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: number | string | null): void {
    const text = value == null ? '' : String(value);
    this.renderer.setProperty(
      this.element,
      'value',
      this.isCurrency() ? formatCurrency(text) : text,
    );
  }

  registerOnChange(callback: (value: number | string | null) => void): void {
    this.onChange = callback;
  }

  registerOnTouched(callback: () => void): void {
    this.onTouched = callback;
  }

  setDisabledState(disabled: boolean): void {
    this.renderer.setProperty(this.element, 'disabled', disabled);
  }

  protected updateValue(event: Event): void {
    const inputEvent = event instanceof InputEvent ? event : undefined;
    if (inputEvent?.isComposing) return;
    const { value, selectionStart, type, valueAsNumber } = this.element;
    if (!this.isCurrency()) {
      const unformattedValue =
        type === 'number' ? (Number.isNaN(valueAsNumber) ? null : valueAsNumber) : value;
      this.onChange(unformattedValue);
      return;
    }

    const amount = ungroup(value);
    const valid = /^-?\d*(?:\.\d{0,2})?$/.test(amount);
    const formatted = valid ? formatCurrency(amount) : value;
    if (formatted !== value) {
      this.renderer.setProperty(this.element, 'value', formatted);
      if (selectionStart !== null) {
        let charactersBeforeCaret = ungroup(value.slice(0, selectionStart)).length;
        let caret = 0;
        while (caret < formatted.length && charactersBeforeCaret > 0) {
          if (formatted[caret] !== '₦' && formatted[caret] !== ',') charactersBeforeCaret--;
          caret++;
        }
        if (
          formatted[caret] === '₦' ||
          (formatted[caret] === ',' && inputEvent?.inputType === 'deleteContentForward')
        ) {
          caret++;
        }
        this.element.setSelectionRange(caret, caret);
      }
    }

    const numericAmount = Number(amount);
    this.onChange(
      valid && /\d/.test(amount) && Number.isFinite(numericAmount) ? numericAmount : null,
    );
  }
}

function ungroup(value: string): string {
  return value.replace(/[₦,\s]/g, '');
}

function formatCurrency(value: string): string {
  if (!value) return '';
  const sign = value.startsWith('-') ? '-' : '';
  const [whole, fraction] = value.slice(sign.length).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + '₦' + grouped + (fraction === undefined ? '' : '.' + fraction);
}
