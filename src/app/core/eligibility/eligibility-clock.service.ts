import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ApplicationStateService } from '../application/application-state.service';
import { ELIGIBILITY_TTL_MS } from '../limits';

/**
 * Counts down the hour an eligibility result stays valid. When it runs out the result and everything decided from it
 * are cleared (the work and salary details stay) and `expired` turns on, so the screen can ask the customer to check
 * again. The clock runs only while a result exists and the application has not been sent.
 */
@Injectable({ providedIn: 'root' })
export class EligibilityClock {
  private readonly state = inject(ApplicationStateService);
  private readonly now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  /** True after a result ran out, until the customer acknowledges it. */
  readonly expired = signal(false);

  private readonly endsAt = computed(() => {
    const at = this.state.eligibilityAt();
    return at ? new Date(at).getTime() + ELIGIBILITY_TTL_MS : null;
  });

  /** Milliseconds left, or null when there is no running result. */
  readonly remainingMs = computed(() => {
    const end = this.endsAt();
    return end === null ? null : Math.max(0, end - this.now());
  });

  /** "59:41" */
  readonly label = computed(() => {
    const ms = this.remainingMs();
    if (ms === null) return '';
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });

  /** Under five minutes: the pill turns to a warning. */
  readonly low = computed(() => (this.remainingMs() ?? Infinity) <= 5 * 60 * 1000);

  constructor() {
    effect(() => {
      if (this.endsAt() === null) {
        this.stop();
        return;
      }
      this.now.set(Date.now());
      this.start();
    });
    effect(() => {
      if (this.remainingMs() === 0) {
        this.state.expireEligibility();
        this.expired.set(true);
      }
    });
  }

  acknowledge(): void {
    this.expired.set(false);
  }

  private start(): void {
    if (this.timer || typeof setInterval === 'undefined') return;
    this.timer = setInterval(() => this.now.set(Date.now()), 1000);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
