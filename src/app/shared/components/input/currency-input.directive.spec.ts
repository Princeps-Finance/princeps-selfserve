import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CurrencyInputDirective } from './currency-input.directive';
import { InputDirective } from './input.directive';

@Component({
  imports: [CurrencyInputDirective, InputDirective, ReactiveFormsModule],
  template: `<input appInput isCurrency type="text" [formControl]="amount" />`,
})
class CurrencyField {
  readonly amount = new FormControl<number | null>(125000);
}

describe('currency input', () => {
  it('displays formatted amounts while keeping the reactive form value numeric', () => {
    const fixture = TestBed.createComponent(CurrencyField);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const { amount } = fixture.componentInstance;
    expect(input.value).toBe('₦125,000');

    input.value = '₦42,350.25';
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste' }));
    expect(amount.value).toBe(42350.25);

    input.value = '14000';
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText' }));
    expect(input.value).toBe('₦14,000');
    expect(amount.value).toBe(14000);

    input.value = '';
    input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward' }));
    expect(amount.value).toBeNull();
    amount.setValue(50000);
    expect(input.value).toBe('₦50,000');
  });
});
