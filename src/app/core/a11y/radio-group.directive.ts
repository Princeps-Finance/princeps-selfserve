import { Directive, ElementRef, inject } from '@angular/core';

const NAV_KEYS = new Set(['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End']);

/**
 * Arrow-key navigation for a group of `role="radio"` elements (ARIA APG radio
 * pattern). Moving focus also selects, as native radios do. Pair with a roving
 * `tabindex` (0 on the checked radio, -1 on the rest) in the template.
 */
@Directive({
  selector: '[appRadioGroup]',
  host: { '(keydown)': 'onKeydown($event)' },
})
export class RadioGroupDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  onKeydown(event: KeyboardEvent): void {
    if (!NAV_KEYS.has(event.key)) return;
    const radios = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('[role="radio"]'),
    );
    const current = radios.findIndex((r) => r === event.target || r.contains(event.target as Node));
    if (current === -1) return;

    let next = current;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (current + 1) % radios.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (current - 1 + radios.length) % radios.length;
    else if (event.key === 'Home') next = 0;
    else next = radios.length - 1;

    event.preventDefault();
    radios[next].focus();
    radios[next].click();
  }
}
