import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';
import {
  ChangeDetectionStrategy, Component, ElementRef, computed, forwardRef, inject, input, model, signal, viewChild,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TPipe } from '../i18n/t.pipe';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  /** A small picture shown beside the label, such as a bank's logo. */
  readonly logo?: string;
  /** Shown in a badge when there is no logo. Set it to show a mark for every option. */
  readonly initials?: string;
}

/**
 * Branded select. A button opens a sheet (bottom sheet on phones, centred on larger screens)
 * with an optional search box and a list. Replaces the browser's native <select> so the control
 * looks the same everywhere and the chevron respects the field padding.
 */
@Component({
  selector: 'app-select-field',
  imports: [IconComponent, ModalComponent, NgOptimizedImage, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectFieldComponent), multi: true }],
  template: `
    <button
      #trigger
      type="button"
      class="trigger"
      [id]="inputId()"
      [disabled]="disabled()"
      [attr.aria-invalid]="invalid() ? true : null"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      (click)="show()"
    >
      @if (selected(); as s) {
        @if (s.logo || s.initials) {
          <span class="mark" aria-hidden="true">
            @if (s.logo) { <img [ngSrc]="s.logo" width="24" height="24" alt="" /> } @else { {{ s.initials }} }
          </span>
        }
      }
      <span class="value" [class.placeholder]="!selected()">{{ selected()?.label ?? placeholder() }}</span>
      <app-icon name="bold-chevron-down" [size]="18" class="chev" />
    </button>

    <app-modal [open]="open()" [title]="title()" (closed)="onClosed()">
      <div class="panel">
        <h2 class="sheet-title">{{ title() }}</h2>
        @if (searchable()) {
          <input
            #search
            class="search"
            type="search"
            inputmode="search"
            autocomplete="off"
            [attr.aria-label]="'select.search' | t"
            [placeholder]="'select.search' | t"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        }
        <div class="list" role="listbox" [attr.aria-label]="title()" tabindex="-1">
          @for (o of filtered(); track o.value) {
            <button type="button" role="option" class="opt" [attr.aria-selected]="o.value === value()" (click)="pick(o)">
              @if (o.logo || o.initials) {
                <span class="mark" aria-hidden="true">
                  @if (o.logo) { <img [ngSrc]="o.logo" width="24" height="24" alt="" loading="lazy" /> } @else { {{ o.initials }} }
                </span>
              }
              <span class="label">{{ o.label }}</span>
              @if (o.value === value()) {
                <app-icon name="bold-success" [size]="18" />
              }
            </button>
          } @empty {
            <p class="none" role="status">{{ 'select.none' | t }}</p>
          }
        </div>
      </div>
    </app-modal>
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
      @media (hover: hover) and (pointer: fine) { .trigger:hover:not(:disabled) { border-color: var(--input-border-hover); } }
      .trigger:focus-visible { outline: 2px solid transparent; border-color: var(--input-border-focus); box-shadow: var(--input-shadow-focus); }
      .trigger[aria-invalid='true'] { border-color: var(--danger-text); }
      .trigger:disabled { opacity: 0.55; cursor: not-allowed; }
      .value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .value.placeholder { color: var(--ink-muted); }
      .chev { flex: none; color: var(--ink-soft); }
      /* A white tile so a coloured logo reads the same in light and dark mode. */
      .mark {
        flex: none; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
        border-radius: var(--radius-sm, 8px); border: 1px solid var(--hairline); background: #fff; overflow: hidden;
        font-size: 12px; font-weight: 600; color: #3a3f47;
      }
      .mark img { width: 24px; height: 24px; object-fit: contain; }
      .label { flex: 1; min-width: 0; }

      .panel { display: flex; flex-direction: column; gap: var(--space-3); }
      .sheet-title { margin: 0; font-family: var(--font-display); font-size: var(--fs-lg); font-weight: 600; letter-spacing: -0.01em; }
      .search {
        width: 100%; min-height: 48px; padding: 0 var(--space-4); border: 1px solid var(--input-border);
        border-radius: var(--input-radius); background: var(--input-bg); font: inherit; font-size: var(--fs-base); color: var(--ink);
      }
      .list { overscroll-behavior: contain; display: flex; flex-direction: column; }
      .opt {
        display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
        min-height: 52px; padding: 0 var(--space-2); border: 0; border-bottom: 1px solid var(--hairline);
        background: transparent; font: inherit; font-size: var(--fs-base); color: var(--ink); text-align: start; cursor: pointer;
      }
      .opt[aria-selected='true'] { font-weight: 600; color: var(--text-accent); }
      @media (hover: hover) and (pointer: fine) { .opt:hover { background: var(--hover-tint); } }
      .opt:focus-visible, .search:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
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

  readonly value = model<string>('');
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly query = signal('');

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');

  protected readonly selected = computed(() => this.options().find((o) => o.value === this.value()) ?? null);
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.options().filter((o) => o.label.toLowerCase().includes(q)) : this.options();
  });

  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(v: string | null): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected show(): void {
    this.query.set('');
    this.open.set(true);
    setTimeout(() => {
      const sel = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('[aria-selected="true"]');
      sel?.scrollIntoView({ block: 'center' });
      // Searching is for desktop; on phones an auto-opened keyboard would hide the list.
      if (this.search() && window.matchMedia('(min-width: 560px)').matches) this.search()!.nativeElement.focus();
    });
  }

  protected hide(): void { this.open.set(false); }

  protected onClosed(): void {
    this.open.set(false);
    this.onTouched();
    this.trigger().nativeElement.focus();
  }

  protected pick(o: SelectOption): void {
    this.value.set(o.value);
    this.onChange(o.value);
    this.hide();
  }
}
