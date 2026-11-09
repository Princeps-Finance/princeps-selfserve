import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RadioGroupDirective } from './radio-group.directive';

@Component({
  imports: [RadioGroupDirective],
  template: `
    <ul appRadioGroup role="radiogroup" aria-label="Pick one">
      @for (o of options; track o) {
        <li>
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="selected() === o"
            [attr.tabindex]="selected() === o ? 0 : -1"
            (click)="selected.set(o)"
          >
            {{ o }}
          </button>
        </li>
      }
    </ul>
  `,
})
class HostComponent {
  readonly options = ['a', 'b', 'c'];
  readonly selected = signal('a');
}

describe('RadioGroupDirective', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const radios = Array.from(
      fixture.nativeElement.querySelectorAll('[role=radio]'),
    ) as HTMLButtonElement[];
    return { fixture, radios, host: fixture.componentInstance };
  }
  const press = (el: HTMLElement, key: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  it('moves focus and selection with the arrow keys, wrapping at the ends', () => {
    const { fixture, radios, host } = setup();
    radios[0].focus();
    press(radios[0], 'ArrowDown');
    fixture.detectChanges();
    expect(host.selected()).toBe('b');
    expect(document.activeElement).toBe(radios[1]);

    press(radios[1], 'ArrowUp');
    press(radios[0], 'ArrowUp');
    fixture.detectChanges();
    expect(host.selected()).toBe('c');
  });

  it('supports Home and End and ignores other keys', () => {
    const { fixture, radios, host } = setup();
    radios[0].focus();
    press(radios[0], 'End');
    fixture.detectChanges();
    expect(host.selected()).toBe('c');
    press(radios[2], 'Home');
    fixture.detectChanges();
    expect(host.selected()).toBe('a');
    press(radios[0], 'x');
    expect(host.selected()).toBe('a');
  });

  it('leaves only the selected radio in the tab order', () => {
    const { radios } = setup();
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });
});
