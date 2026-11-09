import { Injectable, signal } from '@angular/core';

/** Version of the privacy notice text. Bump it whenever the notice changes; it is recorded with consent. */
export const PRIVACY_NOTICE_VERSION = '2026-11-1';

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  readonly isOpen = signal(false);
  open(): void { this.isOpen.set(true); }
  close(): void { this.isOpen.set(false); }
}
