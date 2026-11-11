import { Injectable, inject, signal } from '@angular/core';
import { API_CLIENT, Quote, QuoteInput } from '../api/api-client';
import { ApplicationStateService, OfferDraft } from '../application/application-state.service';
import { productById } from '../products/products';
import { ToastService } from '../toast/toast.service';
import { LangService } from '../i18n/lang.service';
import { APPLY } from '../flow/apply-routes';
import { FlowNavigator } from '../flow/flow-navigator.service';

/** The wait after the last change to the amount or period, so dragging a slider asks the server once, not on every step. */
export const QUOTE_DEBOUNCE_MS = 350;
/** A quote with less than this left is asked for again before it is used. */
const REFRESH_BEFORE_MS = 30_000;

export type QuoteStatus = 'loading' | 'ready' | 'error' | 'invalid';
export interface QuoteView {
  /** The terms this answer is for, so a late answer for older terms is never shown as current. */
  key: string;
  status: QuoteStatus;
  quote?: Quote;
}

export const quoteKey = (i: QuoteInput): string => `${i.productId}|${i.amount}|${i.tenorMonths}|${i.referralCode ?? ''}`;

/** The offer the rest of the application works from: the server's figures, never our own sums. */
export function offerFromQuote(quote: Quote, productName: string, referralCode?: string): OfferDraft {
  return {
    productId: quote.productId,
    productName,
    amount: quote.amount,
    tenorMonths: quote.tenorMonths,
    ratePercent: quote.ratePercent,
    interestModel: quote.interestModel,
    monthlyRepayment: quote.monthlyRepayment,
    fees: quote.fees,
    quote,
    ...(referralCode ? { referralCode } : {}),
  };
}

/**
 * Gets the repayment figures from the server. While a customer moves the amount, the screen shows a local estimate and
 * this asks the server once they pause; the answer is used only if it is still for the terms on screen. Before any later
 * step relies on a quote it checks the quote is still valid and, when it ran out, asks again.
 */
@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LangService);
  private readonly flow = inject(FlowNavigator);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly _views = signal<Record<string, QuoteView>>({});
  readonly views = this._views.asReadonly();

  /** The latest answer for a product, if it is for exactly these terms. */
  viewFor(productId: string, input: QuoteInput): QuoteView | null {
    const v = this._views()[productId];
    return v && v.key === quoteKey(input) ? v : null;
  }

  /** Asks for these terms after a short pause. The previous answer stops counting at once. */
  request(input: QuoteInput, { immediately = false } = {}): void {
    const key = quoteKey(input);
    const current = this._views()[input.productId];
    if (current?.key === key && (current.status === 'ready' || current.status === 'loading')) return;
    this.set(input.productId, { key, status: 'loading' });
    const old = this.timers.get(input.productId);
    if (old) clearTimeout(old);
    const run = (): void => void this.fetch(input, key);
    if (immediately) run();
    else this.timers.set(input.productId, setTimeout(run, QUOTE_DEBOUNCE_MS));
  }

  private async fetch(input: QuoteInput, key: string): Promise<void> {
    const res = await this.api.getQuote(input).catch(() => ({ status: 'unavailable' as const }));
    // The customer has moved on to other terms since this was asked: drop the answer.
    if (this._views()[input.productId]?.key !== key) return;
    if (res.status === 'ok') this.set(input.productId, { key, status: 'ready', quote: res.quote });
    else this.set(input.productId, { key, status: res.status === 'invalid' ? 'invalid' : 'error' });
  }

  private set(productId: string, view: QuoteView): void {
    this._views.update((all) => ({ ...all, [productId]: view }));
  }

  /**
   * Before the offer letter, the mandate or the final send relies on the accepted quote. 'ok': still valid (renewed
   * quietly if it ran out and the figures are the same). 'changed': the figures are different now, so the customer must
   * look at them again. 'failed': could not confirm, so nothing should go on.
   */
  async ensureFresh(): Promise<'ok' | 'changed' | 'failed'> {
    const offer = this.state.offer();
    const quote = offer?.quote;
    if (!offer || !quote) return 'failed';
    if (Date.parse(quote.expiresAt) - Date.now() > REFRESH_BEFORE_MS) return 'ok';
    const res = await this.api
      .getQuote({ productId: offer.productId, amount: offer.amount, tenorMonths: offer.tenorMonths, ...(offer.referralCode ? { referralCode: offer.referralCode } : {}) })
      .catch(() => ({ status: 'unavailable' as const }));
    if (res.status !== 'ok') return 'failed';
    const same =
      res.quote.monthlyRepayment === quote.monthlyRepayment &&
      res.quote.totalRepayable === quote.totalRepayable &&
      res.quote.totalFees === quote.totalFees &&
      res.quote.ratePercent === quote.ratePercent &&
      res.quote.firstDueDate === quote.firstDueDate;
    if (same) {
      this.state.renewQuote(res.quote);
      return 'ok';
    }
    this.state.setOffer(offerFromQuote(res.quote, offer.productName, offer.referralCode));
    return 'changed';
  }

  /**
   * The check every later step makes before it relies on the accepted quote. True: go on. False: the customer has been told
   * why (the figures changed, so they are back on the terms to look again; or they could not be confirmed) and nothing goes on.
   */
  async confirm(): Promise<boolean> {
    const fresh = await this.ensureFresh();
    if (fresh === 'ok') return true;
    if (fresh === 'failed') {
      this.toast.error(this.lang.t('quote.failed'));
      return false;
    }
    this.toast.info(this.lang.t('quote.changed'), 8000);
    await this.flow.go(APPLY.terms);
    return false;
  }

  /** The product's display name, for building an offer from a bare quote. */
  nameOf(productId: string): string {
    return productById(productId)?.name ?? productId;
  }
}
