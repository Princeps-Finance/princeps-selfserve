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
      :host { display: block; }
      .pill {
        margin: 0; display: inline-flex; align-items: center; gap: var(--space-2);
        padding: var(--space-2) var(--space-4) var(--space-2) var(--space-3); border-radius: var(--radius-pill);
        background: var(--info-soft); color: var(--text-accent); font-size: var(--fs-sm); font-weight: 500;
      }
      .pill.is-low { background: var(--warning-soft); color: var(--ink); }

      /* The countdown is easy to miss, so on arrival it slams in the way a loud message does in iMessage: big, then thrown
         down to size with a quick shake. It plays once, a beat after the page settles. A last-five-minutes warning shakes again. */
      @media (prefers-reduced-motion: no-preference) {
        .pill { transform-origin: center; animation: slam 700ms cubic-bezier(0.2, 0.7, 0.2, 1) 250ms both; }
        .pill.is-low { animation: shake 600ms ease-in-out 0ms both; }
      }
      @keyframes slam {
        0% { transform: scale(1.6); opacity: 0; }
        30% { transform: scale(0.94); opacity: 1; }
        45% { transform: scale(1.04) translateX(-4px); }
        57% { transform: scale(1) translateX(4px); }
        69% { transform: translateX(-3px); }
        81% { transform: translateX(2px); }
        100% { transform: scale(1) translateX(0); opacity: 1; }
      }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        15% { transform: translateX(-5px) scale(1.05); }
        30% { transform: translateX(5px) scale(1.05); }
        45% { transform: translateX(-4px); }
        60% { transform: translateX(3px); }
        80% { transform: translateX(-2px); }
      }
      .time { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
      .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    `,
  ],
})
export class ResultTimerComponent {
  protected readonly clock = inject(EligibilityClock);
}
