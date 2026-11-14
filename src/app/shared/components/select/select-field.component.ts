import {
  ChangeDetectionStrategy, Component, computed, forwardRef, input, model, signal, viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CdkListbox, CdkOption } from '@angular/cdk/listbox';
import { TPipe } from '../../../core/i18n/t.pipe';
import { DialogComponent } from '../dialog/dialog.component';
import { InputDirective } from '../input/input.directive';
import type { SelectOption } from './select-option';

/**
 * Branded select. A button opens a sheet (bottom sheet on phones, centred on larger screens)
 * with an optional search box and a list. Replaces the browser's native <select> so the control
 * looks the same everywhere and the chevron respects the field padding.
 */
@Component({
  selector: 'app-select-field',
  imports: [TPipe, DialogComponent, InputDirective, CdkListbox, CdkOption],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectFieldComponent), multi: true }],
  template: `
    <button
      type="button"
      class="trigger"
      [id]="inputId()"
      [disabled]="disabled()"
      [attr.aria-invalid]="invalid() ? true : null"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      (click)="show()"
      (blur)="!open() && markTouched()"
    >
      <span class="value" [class.placeholder]="!selected()">{{ selected()?.label ?? placeholder() }}</span>
      <svg class="chev" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <app-dialog #dialog [open]="open()" [title]="title()" layout="sheet" [autoFocus]="initialFocus()" (closed)="onClosed()">
      <ng-template>
        @if (searchable()) {
          <input
            appInput
            class="search"
            type="search"
            inputmode="search"
            autocomplete="off"
            [attr.aria-label]="'select.search' | t"
            [placeholder]="'select.search' | t"
            [value]="query()"
            (input)="readQuery($event)"
          />
        }
        <div class="list" cdkListbox [cdkListboxValue]="visibleSelection()" [attr.aria-label]="title()"
          (cdkListboxValueChange)="pick($event.value[0])">
          @for (o of filtered(); track o.value) {
            <button type="button" class="opt" [cdkOption]="o.value"
              (click)="pickCurrent(o.value)" (keydown.enter)="pickCurrent(o.value)" (keydown.space)="pickCurrent(o.value)">
              <span>{{ o.label }}</span>
              @if (o.value === value()) {
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4.5 10.5L8.5 14.5L15.5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              }
            </button>
          } @empty {
            <p class="none" role="status">{{ 'select.none' | t }}</p>
          }
        </div>
      </ng-template>
    </app-dialog>
  `,
  styles: [
    `
      :host { display: block; }
      .trigger {
        width: 100%; min-height: var(--input-height);
        display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
        padding: 0 var(--space-4);
        background: var(--input-bg); border: 1px solid var(--input-border); border-radius: var(--input-radius);
        font-family: var(--font-sans); font-size: var(--fs-base); color: var(--ink); text-align: start; cursor: pointer;
        transition: border-color 140ms ease, box-shadow 140ms ease;
      }
      .trigger:hover:not(:disabled) { border-color: var(--input-border-hover); }
      .trigger:focus-visible { outline: 2px solid transparent; border-color: var(--input-border-focus); box-shadow: var(--input-shadow-focus); }
      .trigger[aria-invalid='true'] { border-color: var(--danger-text); }
      .trigger:disabled { opacity: 0.55; cursor: not-allowed; }
      .value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .value.placeholder { color: var(--ink-muted); }
      .chev { flex: none; color: var(--ink-soft); }

      .search { margin-bottom: var(--space-3); }
      .list { overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; }
      .opt {
        display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
        min-height: 52px; padding: 0 var(--space-2); border: 0; border-bottom: 1px solid var(--hairline);
        background: transparent; font: inherit; font-size: var(--fs-base); color: var(--ink); text-align: start; cursor: pointer;
      }
      .opt[aria-selected='true'] { font-weight: 600; color: var(--text-accent); }
      .opt:hover { background: var(--hover-tint); }
      .opt:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
      .none { margin: 0; padding: var(--space-5) var(--space-2); color: var(--ink-soft); }
    `,
  ],
})
export class SelectFieldComponent implements ControlValueAccessor {
  readonly inputId = input<string>('');
  readonly options = input.required<readonly SelectOption[]>();
  readonly placeholder = input<string>('—');
  readonly title = input<string>('');
  readonly searchable = input<boolean>(false);
  readonly invalid = input<boolean | null>(null);

  readonly value = model('');
  readonly isDisabled = input(false);
  private readonly formDisabled = signal(false);
  protected readonly disabled = computed(() => this.isDisabled() || this.formDisabled());
  protected readonly open = signal(false);
  protected readonly query = signal('');

  private readonly dialog = viewChild.required<DialogComponent>('dialog');
  protected readonly initialFocus = signal('first-heading');

  protected readonly selected = computed(() => this.options().find((o) => o.value === this.value()) ?? null);
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.options().filter((o) => o.label.toLowerCase().includes(q)) : this.options();
  });

  protected readonly visibleSelection = computed(() =>
    this.filtered().some((option) => option.value === this.value()) ? [this.value()] : [],
  );

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void { this.value.set(value ?? ''); }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
    if (disabled) this.open.set(false);
  }

  protected show(): void {
    this.query.set('');
    const focusSearch = this.searchable() && matchMedia('(min-width: 560px)').matches;
    this.initialFocus.set(focusSearch ? '.search' : 'first-heading');
    this.open.set(true);
  }

  protected readQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected markTouched(): void {
    if (!this.disabled()) this.onTouched();
  }

  protected onClosed(): void {
    this.open.set(false);
    this.markTouched();
  }

  protected pickCurrent(value: string): void {
    if (value === this.value()) this.dialog().close();
  }

  protected pick(value: string): void {
    if (this.disabled()) return;
    this.value.set(value);
    this.onChange(value);
    this.dialog().close();
  }
}
