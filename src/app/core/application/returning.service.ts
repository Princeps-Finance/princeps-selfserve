import { Injectable, signal } from '@angular/core';

const KEY = 'princeps.returning';

/** What this device remembers about the last customer who verified here. Never the BVN, a token or a full phone number. */
export interface ReturningCustomer {
  /** Opaque handle from the back end. On its own it grants nothing: a code to the BVN-linked phone is still needed. */
  ref: string;
  firstName: string;
  /** Already masked, for example "+234 •••• ••78". */
  maskedPhone: string;
}

/**
 * Lets a customer come back with one tap ("Continue as Ada") instead of typing the BVN again. The customer can always
 * choose "Not you?", which forgets this device. Shared phones are safe because nothing here opens an account.
 */
@Injectable({ providedIn: 'root' })
export class ReturningService {
  private readonly _saved = signal<ReturningCustomer | null>(this.read());
  readonly saved = this._saved.asReadonly();

  save(customer: ReturningCustomer): void {
    this._saved.set(customer);
    try {
      localStorage.setItem(KEY, JSON.stringify(customer));
    } catch {
      /* storage blocked: the customer types the BVN next time */
    }
  }

  forget(): void {
    this._saved.set(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to forget */
    }
  }

  private read(): ReturningCustomer | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const c = JSON.parse(raw) as Partial<ReturningCustomer>;
      return typeof c.ref === 'string' && /^[\w-]{16,128}$/.test(c.ref) && typeof c.firstName === 'string' && typeof c.maskedPhone === 'string'
        ? { ref: c.ref, firstName: c.firstName.slice(0, 40), maskedPhone: c.maskedPhone.slice(0, 24) }
        : null;
    } catch {
      return null;
    }
  }
}
