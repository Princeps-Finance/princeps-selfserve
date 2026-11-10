import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Pick an amount between two limits. A large, filled slider for rough choices, the two limits named under it,
 * and one-tap chips (quarter, half, three quarters, maximum) for the common ones. The slider is a native range
 * input, so keyboard, screen readers and touch all work without extra code.
 */
@Component({
  selector: 'app-amount-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slider" [style.--pct.%]="percent()">
      <input
        type="range"
        [min]="min()"
        [max]="max()"
        [step]="step()"
        [value]="value()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-valuetext]="format()(value())"
        (input)="onInput($event)"
      />
    </div>
    <div class="limits" aria-hidden="true">
      <span>{{ format()(min()) }}</span>
      <span>{{ format()(max()) }}</span>
    </div>
    <div class="quick" role="group" [attr.aria-label]="quickLabel()">
      @for (q of quick(); track q) {
        <button type="button" class="chip" [attr.aria-pressed]="q === value()" (click)="valueChange.emit(q)">{{ format()(q) }}</button>
      }
    </div>
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; gap: var(--space-2); }
      .slider { --thumb: 28px; display: flex; align-items: center; height: var(--tap-min); }
      input[type='range'] {
        -webkit-appearance: none; appearance: none; width: 100%; height: var(--thumb); margin: 0;
        background: transparent; cursor: pointer;
      }
      /* The track fills with the brand colour up to the thumb; the rest stays a quiet line. */
      input[type='range']::-webkit-slider-runnable-track {
        height: 10px; border-radius: var(--radius-pill);
        background: linear-gradient(to right, var(--action-primary) var(--pct), var(--hairline-strong) var(--pct));
      }
      input[type='range']::-moz-range-track { height: 10px; border-radius: var(--radius-pill); background: var(--hairline-strong); }
      input[type='range']::-moz-range-progress { height: 10px; border-radius: var(--radius-pill); background: var(--action-primary); }
      input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none; width: var(--thumb); height: var(--thumb); margin-top: -9px; border-radius: 50%;
        background: var(--action-primary); border: 4px solid var(--canvas);
        box-shadow: 0 0 0 1px var(--action-primary), var(--shadow-2);
        transition: transform var(--dur-fast) ease;
      }
      input[type='range']::-moz-range-thumb {
        width: 20px; height: 20px; border-radius: 50%; background: var(--action-primary); border: 4px solid var(--canvas);
        box-shadow: 0 0 0 1px var(--action-primary), var(--shadow-2);
      }
      input[type='range']:hover::-webkit-slider-thumb { transform: scale(1.08); }
      input[type='range']:active::-webkit-slider-thumb { transform: scale(1.15); }
      input[type='range']:focus-visible { outline: none; }
      input[type='range']:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 1px var(--action-primary), var(--focus-ring); }
      input[type='range']:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 1px var(--action-primary), var(--focus-ring); }
      .limits { display: flex; justify-content: space-between; font-size: var(--fs-sm); color: var(--ink-muted); font-variant-numeric: tabular-nums; }
      .quick { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-1); }
      .chip {
        min-height: 36px; padding: 0 var(--space-3); border: 0; border-radius: var(--radius-pill);
        background: var(--grey-100); color: var(--ink); font: var(--fw-medium) var(--fs-sm) var(--font-sans);
        font-variant-numeric: tabular-nums; cursor: pointer; transition: background var(--dur-fast) ease;
      }
      .chip:hover { background: var(--grey-200); }
      .chip[aria-pressed='true'] { background: var(--action-primary); color: var(--action-on-primary); font-weight: var(--fw-bold); }
      .chip:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
      @media (prefers-reduced-motion: reduce) { input[type='range']::-webkit-slider-thumb, .chip { transition: none; } }
    `,
  ],
})
export class AmountSliderComponent {
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly step = input(1);
  readonly value = input.required<number>();
  readonly ariaLabel = input('Amount');
  readonly quickLabel = input('Quick amounts');
  readonly format = input<(n: number) => string>((n) => n.toLocaleString('en-NG'));
  readonly valueChange = output<number>();

  protected readonly percent = computed(() => {
    const span = this.max() - this.min();
    return span > 0 ? ((this.value() - this.min()) / span) * 100 : 0;
  });

  /** A quarter, half, three quarters and the maximum, each rounded to a valid step. */
  protected readonly quick = computed(() => {
    const { min, max, step } = { min: this.min(), max: this.max(), step: this.step() };
    const snap = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
    return [...new Set([0.25, 0.5, 0.75, 1].map((f) => snap(min + (max - min) * f)))];
  });

  protected onInput(event: Event): void {
    this.valueChange.emit(Number((event.target as HTMLInputElement).value));
  }
}
