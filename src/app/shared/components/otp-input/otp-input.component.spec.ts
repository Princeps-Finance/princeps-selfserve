import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { OtpInputComponent } from './otp-input.component';

@Component({
  imports: [ReactiveFormsModule, OtpInputComponent],
  template: '<app-otp-input label="Verification code" [formControl]="code" />',
})
class Host {
  readonly code = new FormControl('', { nonNullable: true });
}

describe('OtpInputComponent integration', () => {
  it('accepts a full autofilled code through one input and updates the reactive form', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const field = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(field.autocomplete).toBe('one-time-code');
    field.value = '123 456';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.code.value).toBe('123456');
    expect(field.value).toBe('123456');
    expect([...fixture.nativeElement.querySelectorAll('.otp-cell')].map((cell: HTMLElement) => cell.textContent).join('')).toBe('123456');
    field.dispatchEvent(new Event('blur'));
    expect(fixture.componentInstance.code.touched).toBe(true);
  });

  it('reflects programmatic SMS/reset values and the form disabled state without emitting edits', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const edits = vi.fn();
    fixture.componentInstance.code.valueChanges.subscribe(edits);
    fixture.componentInstance.code.setValue('654321', { emitEvent: false });
    await fixture.whenStable();
    const field = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(field.value).toBe('654321');
    expect(edits).not.toHaveBeenCalled();
    fixture.componentInstance.code.reset();
    fixture.componentInstance.code.disable();
    await fixture.whenStable();
    expect(field.value).toBe('');
    expect(field.disabled).toBe(true);
  });
});
