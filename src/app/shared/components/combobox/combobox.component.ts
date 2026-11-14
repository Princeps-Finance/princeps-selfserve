import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TPipe } from '../../../core/i18n/t.pipe';
import { InputDirective } from '../input/input.directive';
import type { SelectOption } from '../select/select-option';

@Component({
  selector: 'app-combobox',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, InputDirective, TPipe],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ComboboxComponent), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combobox.component.html',
  styleUrl: './combobox.component.css',
})
export class ComboboxComponent implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly placeholder = input('');
  readonly label = input.required<string>();
  readonly invalid = input<boolean | null>(null);

  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly value = signal('');
  private readonly query = signal('');
  protected readonly listId = computed(() => this.inputId() + '-listbox');
  protected readonly text = computed(() => this.value()
    ? this.options().find((option) => option.value === this.value())?.label ?? ''
    : this.query());
  protected readonly filtered = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.options().filter((option) => option.label.toLocaleLowerCase().includes(query));
  });
  protected readonly active = computed(() => this.open() ? this.filtered()[this.activeIndex()] : undefined);
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
    this.query.set('');
    this.close();
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
    if (disabled) this.close();
  }

  protected optionId(option: SelectOption): string {
    return this.listId() + '-' + encodeURIComponent(option.value);
  }

  protected edit(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(-1);
    this.open.set(true);
    if (this.value()) {
      this.value.set('');
      this.onChange('');
    }
  }

  protected select(option: SelectOption): void {
    if (this.disabled()) return;
    this.value.set(option.value);
    this.query.set('');
    this.onChange(option.value);
    this.close();
  }

  protected blur(): void {
    this.close();
    if (!this.disabled()) this.onTouched();
  }

  protected close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    } else if (event.key === 'Enter' && this.open()) {
      event.preventDefault();
      const option = this.active();
      if (option) this.select(option);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open.set(true);
      const count = this.filtered().length;
      if (!count) return;
      const current = this.activeIndex();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = current < 0 ? (step === 1 ? 0 : count - 1) : (current + step + count) % count;
      this.activeIndex.set(next);
      const option = this.filtered()[next];
      requestAnimationFrame(() => {
        if (this.active() === option) document.getElementById(this.optionId(option))?.scrollIntoView({ block: 'nearest' });
      });
    }
  }
}
