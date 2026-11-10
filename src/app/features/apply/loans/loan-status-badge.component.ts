import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LoanSummary } from '../../../core/api/api-client';
import { TPipe } from '../../../core/i18n/t.pipe';

/** The loan's state as a short coloured pill. The words carry the meaning; colour only backs them up. */
@Component({
  selector: 'app-loan-status',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [attr.data-status]="status()">{{ key() | t }}</span>`,
  styles: [
    `
      .badge {
        display: inline-block; padding: 2px var(--space-3); border-radius: var(--radius-pill);
        font: var(--fw-bold) var(--fs-xs) var(--font-sans); background: var(--info-soft); color: var(--ink);
      }
      .badge[data-status='active'] { background: var(--success-soft); color: var(--success-text); }
      .badge[data-status='overdue'] { background: var(--danger-soft); color: var(--danger-text); }
      .badge[data-status='completed'] { background: var(--grey-100); color: var(--ink-soft); }
    `,
  ],
})
export class LoanStatusBadgeComponent {
  readonly status = input.required<LoanSummary['status']>();
  protected readonly key = computed(() => `loans.status.${this.status()}`);
}
