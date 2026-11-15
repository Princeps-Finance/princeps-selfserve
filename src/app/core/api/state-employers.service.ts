import { Injectable, inject, signal } from '@angular/core';
import { API_CLIENT } from './api-client';
import { DEFAULT_STATE_GOVERNMENTS, type StateGovernment } from './state-employers';

/**
 * The states and employers on the state government screen. It starts with the app's own list so the screen is never
 * empty, then swaps in the live list from the back end when that answers.
 */
@Injectable({ providedIn: 'root' })
export class StateEmployersService {
  private readonly api = inject(API_CLIENT, { optional: true });
  private readonly list = signal<readonly StateGovernment[]>(DEFAULT_STATE_GOVERNMENTS);
  private loaded = false;

  readonly states = this.list.asReadonly();

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const live = await this.api?.getStateEmployers();
      if (live?.length) this.list.set(live);
    } catch {
      // The app's own list stays.
    }
  }
}
