import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, IconName } from './icons/icons.generated';

/**
 * One Iconly icon, drawn in the current text colour. Name them "<style>-<name>": bold icons for toasts and actions,
 * outline icons for buttons. Decorative by default; give a `label` when the icon stands alone.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-icon', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  template: `
    <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%" [attr.aria-hidden]="label() ? null : 'true'" [attr.role]="label() ? 'img' : null" [attr.aria-label]="label() || null" focusable="false">
      @for (p of paths(); track $index) {
        <path [attr.d]="p.d" [attr.fill-rule]="p.evenodd ? 'evenodd' : null" [attr.clip-rule]="p.evenodd ? 'evenodd' : null" />
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; line-height: 0; } svg { display: block; }`,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly label = input('');
  protected readonly paths = computed(() => ICONS[this.name()] ?? []);
}
