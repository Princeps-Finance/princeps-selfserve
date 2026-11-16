import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApplicationSession {
  private token: string | null = null;
  private readonly activeApplicationId = signal<string | null>(null);
  private readonly otpVerified = signal(false);
  readonly verified = this.otpVerified.asReadonly();
  readonly applicationId = this.activeApplicationId.asReadonly();
  private readonly version = signal(0);
  readonly generation = this.version.asReadonly();
  private readonly resetEvents = new Subject<void>();
  readonly cancelled = this.resetEvents.asObservable();

  establish(applicationId: string, token: string): void {
    this.reset();
    this.token = token;
    this.activeApplicationId.set(applicationId);
  }

  markVerified(): void {
    if (this.applicationId()) this.otpVerified.set(true);
  }

  tokenFor(applicationId: string): string | null {
    return this.applicationId() === applicationId ? this.token : null;
  }

  reset(): void {
    this.token = null;
    this.otpVerified.set(false);
    this.activeApplicationId.set(null);
    this.version.update((value) => value + 1);
    this.resetEvents.next();
  }
}

export function clearLegacyCustomerStorage(): void {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = globalThis[name];
      for (const key of [
        'princeps.draft',
        'princeps.returning',
        'princeps.check-progress',
        'princeps.receipt',
        'princeps.referral-link',
      ])
        storage.removeItem(key);
    } catch {
      /* Storage can be unavailable in private browsing. */
    }
  }
}
