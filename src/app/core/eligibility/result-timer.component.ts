import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';
import { EligibilityClock } from './eligibility-clock.service';

/** A small pill under the result: how long it stays valid. Turns to a warning in the last five minutes. */
@Component({
  selector: 'app-result-timer',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (clock.remainingMs() !== null) {
      <p class="pill" [class.is-low]="clock.low()" role="timer" aria-live="off">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
        <span>{{ 'result.valid' | t }} <strong class="time">{{ clock.label() }}</strong></span>
      </p>
      @if (clock.low()) {
        <p class="vh" role="status">{{ 'result.valid.low' | t }}</p>
      }
    }
  `,
  styles: [
    `
      .pill {
        margin: 0; align-self: flex-start; display: inline-flex; align-items: center; gap: var(--space-2);
        padding: var(--space-2) var(--space-4) var(--space-2) var(--space-3); border-radius: var(--radius-pill);
        background: var(--info-soft); color: var(--text-accent); font-size: var(--fs-sm); font-weight: 500;
      }
      .pill.is-low { background: var(--warning-soft); color: var(--ink); }
      .time { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
      .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    `,
  ],
})
export class ResultTimerComponent {
  protected readonly clock = inject(EligibilityClock);
}
