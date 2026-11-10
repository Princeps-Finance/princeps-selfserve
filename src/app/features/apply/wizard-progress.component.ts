import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LangService } from '../../core/i18n/lang.service';

const STAGES = 4;

/** Which of the four stages a step belongs to, from its position in the journey. */
function stageOf(step: number): number {
  if (step <= 2) return 1; // contact, OTP
  if (step <= 5) return 2; // bio data, work, salary
  if (step <= 8) return 3; // eligibility, offers, terms
  return 4; // loan documentation
}

/**
 * Four stages instead of "step n of 14": the number of steps varies by product and customer,
 * and a long count at the start discourages people. The stage name says where they are.
 */
@Component({
  selector: 'app-wizard-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bar"
      role="progressbar"
      [attr.aria-label]="label()"
      [attr.aria-valuenow]="stage()"
      aria-valuemin="1"
      [attr.aria-valuemax]="stages"
      [attr.aria-valuetext]="valueText()"
    >
      <span class="fill" [style.width.%]="(stage() / stages) * 100"></span>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .bar { height: 4px; border-radius: 999px; background: var(--hairline-strong); overflow: hidden; }
      .fill { display: block; height: 100%; border-radius: 999px; background: var(--action-secondary); transition: width 320ms ease; }
      @media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
    `,
  ],
})
export class WizardProgressComponent {
  private readonly lang = inject(LangService);

  /** Position of the step in the journey (1 to 14). */
  readonly current = input.required<number>();
  /** Kept for existing callers; the bar always shows four stages. */
  readonly total = input<number>(14);
  readonly label = input<string>('');

  readonly stages = STAGES;
  readonly segments = [1, 2, 3, 4];
  readonly stage = computed(() => stageOf(this.current()));
  readonly valueText = computed(() => {
    this.lang.lang();
    const name = this.lang.t(`progress.stage.${this.stage()}`);
    return `${this.lang
      .t('progress.stage')
      .replace('{current}', String(this.stage()))
      .replace('{total}', String(STAGES))}: ${name}`;
  });
}
