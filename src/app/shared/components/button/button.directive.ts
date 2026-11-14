import { Directive, input } from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'glass';

@Directive({
  selector: 'button[appButton], a[appButton]',
  host: {
    '[attr.data-button-variant]': 'variant()',
    '[class.glass-btn]': "variant() === 'glass'",
  },
})
export class ButtonDirective {
  readonly variant = input<ButtonVariant>('primary');
}
