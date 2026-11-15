import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { environment } from '../../../environments/environment';
import { API_CLIENT } from '../api/api-client';
import { logWarn } from '../log';

export type PushState = 'unavailable' | 'ask' | 'on' | 'blocked';

/**
 * Notifications about the customer's application. Needs the installed service worker (production builds), a
 * VAPID public key, and a back end that sends the pushes. Until all three exist the prompt never shows.
 * The customer is only asked after tapping a button, never on load.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly swPush = inject(SwPush, { optional: true });
  private readonly api = inject(API_CLIENT);

  readonly state = signal<PushState>(this.initial());

  private initial(): PushState {
    if (!environment.vapidPublicKey || !this.swPush?.isEnabled || typeof Notification === 'undefined') return 'unavailable';
    if (Notification.permission === 'denied') return 'blocked';
    return Notification.permission === 'granted' ? 'on' : 'ask';
  }

  /** Asks the browser for permission, subscribes, and hands the subscription to the back end. */
  async enable(): Promise<void> {
    if (!this.swPush || this.state() === 'unavailable') return;
    try {
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: environment.vapidPublicKey });
      await this.api.registerPush(subscription.toJSON());
      this.state.set('on');
    } catch (err) {
      logWarn('notifications could not be turned on', err);
      this.state.set(typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'blocked' : 'ask');
    }
  }
}
