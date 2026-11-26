import { InjectionToken } from '@angular/core';

/** Switches for work that is built but not yet released. Each one is off unless its env value is exactly "true". */
export interface Features {
  /**
   * Federal customers choose IPPIS or Remita on the salary screen, and `payrollMethod` is sent with the salary.
   * Keep it off in production until the back end accepts `payrollMethod` (it rejects unknown fields) and the
   * Remita mandate step is supported.
   */
  readonly remitaSalary: boolean;
}

export const FEATURES = new InjectionToken<Features>('FEATURES', {
  providedIn: 'root',
  factory: () => ({
    remitaSalary: import.meta.env?.NG_APP_FEATURE_REMITA?.trim() === 'true',
  }),
});
