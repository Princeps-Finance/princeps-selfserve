import { Injectable } from '@angular/core';

/**
 * One key per action, so a retry of the same action (a double tap, a timeout, a page refresh and try again) is
 * recognised by the server and never creates a second record. The scope names the action and what it was done
 * with: a different amount or file is a different action and gets a different key. Kept in memory only.
 */
@Injectable({ providedIn: 'root' })
export class IdempotencyService {
  private readonly keys = new Map<string, string>();

  keyFor(scope: string): string {
    let key = this.keys.get(scope);
    if (!key) {
      key = crypto.randomUUID();
      this.keys.set(scope, key);
    }
    return key;
  }
}
