import { Injectable } from '@angular/core';
import { ZOHO_CHAT_SCRIPT_URL } from '../support';
import { logWarn } from '../log';

interface ZohoSalesIq {
  ready?: () => void;
  floatbutton?: { visible: (state: 'show' | 'hide') => void };
  floatwindow?: { visible: (state: 'show' | 'hide') => void };
}
type ZohoWindow = Window & { $zoho?: { salesiq?: ZohoSalesIq } };

/**
 * Screens where the customer types a BVN, a code or an ID number. Chat is never started from them, because
 * once the Zoho script is loaded it stays on the page for the rest of the visit.
 */
const NO_CHAT_ROUTES = ['/apply/bvn', '/apply/verify', '/apply/nin'];

/** True when live chat may be started from this address. */
export function chatAllowedOn(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return !NO_CHAT_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));
}

/**
 * Zoho SalesIQ live chat. The script is loaded only when the customer taps Support, never at startup, so
 * most visits never contact Zoho. Our Support button is the only entry point: Zoho's own floating button
 * is hidden as soon as the widget is ready.
 */
@Injectable({ providedIn: 'root' })
export class LiveChatService {
  private loading: Promise<boolean> | null = null;

  /** Opens the chat window. False when chat is not set up or could not load (blocked, offline): show the contact sheet instead. */
  async open(): Promise<boolean> {
    if (!ZOHO_CHAT_SCRIPT_URL) return false;
    const loaded = await (this.loading ??= this.load());
    if (!loaded) {
      this.loading = null;
      return false;
    }
    try {
      const show = () => (window as ZohoWindow).$zoho?.salesiq?.floatwindow?.visible('show');
      show();
      // Straight after the first load the widget can ignore the call while it draws its window; asking again is harmless.
      setTimeout(show, 600);
      return true;
    } catch (err) {
      logWarn('live chat could not open', err);
      return false;
    }
  }

  private load(): Promise<boolean> {
    return new Promise((resolve) => {
      const w = window as ZohoWindow;
      const zoho = (w.$zoho ??= {});
      const salesiq = (zoho.salesiq ??= {});
      salesiq.ready = () => {
        salesiq.floatbutton?.visible('hide');
        resolve(true);
      };
      const script = document.createElement('script');
      script.id = 'zsiqscript';
      script.defer = true;
      script.src = ZOHO_CHAT_SCRIPT_URL;
      script.onerror = () => {
        script.remove();
        resolve(false);
      };
      document.head.appendChild(script);
      setTimeout(() => resolve(false), 10_000);
    });
  }
}
