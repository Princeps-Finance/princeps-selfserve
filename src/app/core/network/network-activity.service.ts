import { Injectable, computed, signal } from '@angular/core';

/** How long a request may run before the customer is told it is slow. */
const SLOW_AFTER_MS = 6000;
/** A phone clock this far from the server's is wrong enough to break dates and one-time codes. */
const CLOCK_SKEW_MS = 10 * 60 * 1000;

/**
 * What the network is doing right now, for the screens to show: a request that is taking long, a connection that
 * dropped, a session the server no longer accepts, a phone clock that is wrong. The API client reports into it.
 */
@Injectable({ providedIn: 'root' })
export class NetworkActivityService {
  private nextId = 1;
  private readonly started = new Map<number, number>();
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly _slow = signal(false);
  readonly slow = this._slow.asReadonly();
  readonly clockWrong = signal(false);
  /** The server stopped accepting this visit's session (for example it timed out). */
  readonly sessionExpired = signal(false);

  readonly busy = computed(() => this._slow());

  begin(): number {
    const id = this.nextId++;
    this.started.set(id, Date.now());
    this.watch();
    return id;
  }

  end(id: number): void {
    this.started.delete(id);
    this.check();
    if (this.started.size === 0) this.unwatch();
  }

  /** Compares the phone's clock with the server's `Date` header. */
  noteServerDate(header: string | null): void {
    if (!header) return;
    const server = Date.parse(header);
    if (Number.isNaN(server)) return;
    this.clockWrong.set(Math.abs(Date.now() - server) > CLOCK_SKEW_MS);
  }

  acknowledgeSession(): void {
    this.sessionExpired.set(false);
  }

  private check(): void {
    const now = Date.now();
    this._slow.set([...this.started.values()].some((t) => now - t > SLOW_AFTER_MS));
  }

  private watch(): void {
    if (this.timer || typeof setInterval === 'undefined') return;
    this.timer = setInterval(() => this.check(), 1000);
  }

  private unwatch(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this._slow.set(false);
  }
}
