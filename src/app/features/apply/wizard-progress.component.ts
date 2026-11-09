import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ApplicationStateService } from '../../core/application/application-state.service';
import { LangService } from '../../core/i18n/lang.service';

/** Steps 3–7 (employment through profile) are skipped by returning customers. */
const RETURNING_FIRST_SKIPPED = 3;
const RETURNING_LAST_SKIPPED = 7;

@Component({
  selector: 'app-wizard-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <span class="label">{{ label() }}</span>
      <div
        class="bar"
        role="progressbar"
        [attr.aria-label]="label()"
        [attr.aria-valuenow]="shownCurrent()"
        aria-valuemin="1"
        [attr.aria-valuemax]="shownTotal()"
        [attr.aria-valuetext]="valueText()"
      >
        <span class="fill" [style.width.%]="percent()"></span>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap {
        display: flex; flex-direction: column; gap: var(--space-2);
        font-family: var(--font-sans);
      }
      .label {
        font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--ink-muted); font-weight: 500;
      }
      .bar {
        height: 3px; background: var(--hairline);
        border-radius: 999px; overflow: hidden;
      }
      .fill {
        display: block; height: 100%; background: var(--ink);
        border-radius: 999px;
        transition: width 320ms cubic-bezier(0.2, 0.7, 0.1, 1);
      }
      @media (prefers-reduced-motion: reduce) {
        .fill { transition: none; }
      }
    `,
  ],
})
export class WizardProgressComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly lang = inject(LangService);

  readonly current = input.required<number>();
  readonly total = input.required<number>();
  readonly label = input<string>('');

  private readonly skipped = computed(() =>
    this.state.isReturningCustomer() ? RETURNING_LAST_SKIPPED - RETURNING_FIRST_SKIPPED + 1 : 0,
  );
  readonly shownTotal = computed(() => this.total() - this.skipped());
  readonly shownCurrent = computed(() =>
    this.skipped() > 0 && this.current() > RETURNING_LAST_SKIPPED
      ? this.current() - this.skipped()
      : this.current(),
  );
  readonly percent = computed(() =>
    Math.min(100, Math.max(0, (this.shownCurrent() / this.shownTotal()) * 100)),
  );
  readonly valueText = computed(() => {
    this.lang.lang();
    return this.lang
      .t('progress.step')
      .replace('{current}', String(this.shownCurrent()))
      .replace('{total}', String(this.shownTotal()));
  });
}
