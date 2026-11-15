import { Injectable, computed, inject, signal } from '@angular/core';
import { API_CLIENT } from '../api/api-client';
import { ApplicationStateService } from '../application/application-state.service';
import { productById } from '../products/products';
import { APPLY } from './apply-routes';

/**
 * The steps after the customer has taken an offer. Their order is not fixed in the app: a product can set it
 * (`settings.journey`) and the back end can send it for the chosen product. Everything that moves the customer
 * on or back, and every guard on these screens, asks this service instead of naming the next screen.
 */
export type JourneyKey = 'nin' | 'documents' | 'identity' | 'offer-letter' | 'mandate' | 'submit';

export const JOURNEY_ROUTE: Record<JourneyKey, string> = {
  nin: APPLY.nin,
  documents: APPLY.documents,
  identity: APPLY.verifyIdentity,
  'offer-letter': APPLY.offerLetter,
  mandate: APPLY.mandate,
  submit: APPLY.submit,
};

export const DEFAULT_JOURNEY: readonly JourneyKey[] = ['nin', 'documents', 'identity', 'offer-letter', 'mandate', 'submit'];
const KEYS = new Set<string>(DEFAULT_JOURNEY);

/** Turns whatever a product or the back end sent into a safe order: known steps only, no repeats, submit last. */
export function sanitizeJourney(raw: unknown): JourneyKey[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const seen = new Set<string>();
  const out: JourneyKey[] = [];
  for (const k of raw) {
    if (typeof k !== 'string' || !KEYS.has(k) || k === 'submit' || seen.has(k)) continue;
    seen.add(k);
    out.push(k as JourneyKey);
  }
  // The mandate and the documents are never dropped: they are what the loan is built on.
  for (const must of ['documents', 'mandate'] as const) if (!seen.has(must)) out.push(must);
  return out.length ? [...out, 'submit'] : null;
}

@Injectable({ providedIn: 'root' })
export class JourneyService {
  private readonly state = inject(ApplicationStateService);
  private readonly api = inject(API_CLIENT, { optional: true });

  /** The order the back end sent for the chosen product, if it sent one. */
  private readonly fromApi = signal<{ productId: string; steps: JourneyKey[] } | null>(null);

  /** The steps for this customer, in order. */
  readonly steps = computed<JourneyKey[]>(() => {
    const productId = this.state.offer()?.productId ?? '';
    const product = productById(productId);
    const api = this.fromApi();
    const order = (api && api.productId === productId ? api.steps : null) ?? sanitizeJourney(product?.settings.journey) ?? [...DEFAULT_JOURNEY];
    // The NIN check only belongs where the product asks for it.
    return order.filter((k) => k !== 'nin' || (product?.settings.requiresNin ?? false));
  });

  /** Asks the back end for this product's order. Quietly keeps the default when it cannot answer. */
  async load(productId: string): Promise<void> {
    if (!productId) return;
    try {
      const steps = sanitizeJourney(await this.api?.getJourney(productId));
      this.fromApi.set(steps ? { productId, steps } : null);
    } catch {
      this.fromApi.set(null);
    }
  }

  private done(key: JourneyKey): boolean {
    const s = this.state;
    switch (key) {
      case 'nin': return !!s.nin()?.verified;
      case 'documents': return s.docs().length > 0 && s.docs().every((d) => d.status === 'uploaded');
      case 'identity': return !!s.identityVerification();
      case 'offer-letter': return !!s.termsAcceptedAt();
      case 'mandate': return !!s.mandate()?.authorized;
      case 'submit': return s.submission().status === 'received';
    }
  }

  keyOf(url: string): JourneyKey | null {
    const path = url.split('?')[0];
    return (Object.keys(JOURNEY_ROUTE) as JourneyKey[]).find((k) => JOURNEY_ROUTE[k] === path) ?? null;
  }

  /** Where to send a customer who may not open `key` yet: the first earlier step still open. Null when `key` may open. */
  blockedAt(key: JourneyKey): string | null {
    const steps = this.steps();
    const i = steps.indexOf(key);
    if (i < 0) return JOURNEY_ROUTE[steps[0]];
    const open = steps.slice(0, i).find((k) => !this.done(k));
    return open ? JOURNEY_ROUTE[open] : null;
  }

  first(): string {
    return JOURNEY_ROUTE[this.steps()[0]];
  }

  /** The screen after `url`, or the last one's own address when `url` is not in the journey. */
  next(url: string): string {
    const steps = this.steps();
    const i = steps.findIndex((k) => JOURNEY_ROUTE[k] === url.split('?')[0]);
    return JOURNEY_ROUTE[steps[Math.min(i + 1, steps.length - 1)]] ?? JOURNEY_ROUTE.submit;
  }

  /** The screen before `url`: the previous step, or the terms screen when it is the first. Null when `url` is not a step. */
  previous(url: string): string | null {
    const steps = this.steps();
    const i = steps.findIndex((k) => JOURNEY_ROUTE[k] === url.split('?')[0]);
    if (i < 0) return null;
    return i === 0 ? APPLY.terms : JOURNEY_ROUTE[steps[i - 1]];
  }
}
