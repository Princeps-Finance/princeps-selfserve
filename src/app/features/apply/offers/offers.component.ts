import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { IllustrationComponent } from '../../../core/ui/illustration.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { RadioGroupDirective } from '../../../core/a11y/radio-group.directive';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { Product, RepaymentFrequency, productsFor } from '../../../core/products/products';
import { LoanQuote, clampAmount, estimateApr, offerLimits, quoteLoan } from '../../../../shared/pricing';
import { formatNaira } from '../../../core/money.util';
import { telLink, whatsappLink } from '../../../core/support';
import { LangService } from '../../../core/i18n/lang.service';
import { discountedRate } from '../../../../shared/referral';
import { resolveAmount } from './amount-request';
import { AmountSliderComponent } from '../../../shared/amount-slider.component';
import { ReferralBoxComponent } from './referral-box.component';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

interface Limits {
  minAmount: number;
  maxAmount: number;
  minTenor: number;
  maxTenor: number;
}

interface OfferView {
  product: Product;
  limits: Limits;
  amount: number;
  tenor: number;
  tenors: number[];
  quote: LoanQuote;
  /** Estimated yearly rate including fees, for comparing offers. */
  apr: number;
}

/**
 * A few round choices (3, 6, 9, 12 months) plus the longest allowed, instead of every month:
 * ten buttons is noise, and nobody needs to choose between 7 and 8 months.
 */
function tenorChoices(limits: Limits, current: number): number[] {
  const set = new Set<number>();
  for (let t = 3; t <= limits.maxTenor; t += 3) if (t >= limits.minTenor) set.add(t);
  set.add(limits.maxTenor);
  set.add(current);
  return [...set].sort((a, b) => a - b);
}

/** A copy of the map with one product's entry set, or removed when the value is null. */
function withEntry(map: Record<string, number>, id: string, value: number | null): Record<string, number> {
  const copy = { ...map };
  if (value === null) delete copy[id];
  else copy[id] = value;
  return copy;
}

interface Choice {
  amount: number;
  tenor: number;
}

@Component({
  selector: 'app-offers',
  imports: [IllustrationComponent, TPipe, WizardProgressComponent, RadioGroupDirective, ReferralBoxComponent, AmountSliderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offers.component.html',
  styleUrl: './offers.component.css',
})
export class OffersComponent implements OnInit {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly lang = inject(LangService);

  private readonly catalogue = signal<{ product: Product; limits: Limits }[]>([]);
  /** What the customer has chosen per product. Starts at the most they are eligible for. */
  private readonly choices = signal<Record<string, Choice>>({});
  /** Set when an amount typed by the customer had to be adjusted to fit. */
  readonly adjusted = signal<Record<string, number>>({});
  /** Amounts typed above the limit, by product: the customer is offered an agent for these. */
  readonly askedMore = signal<Record<string, number>>({});

  readonly referral = this.state.referral;

  readonly formatNaira = formatNaira;
  readonly justChecking = computed(() => this.state.intent() === 'check');
  readonly reviewRequired = computed(() => this.state.eligibility()?.decision === 'review');
  readonly whatsapp = whatsappLink('Hello Princeps, I could not find a loan that fits my details and would like help.');
  readonly tel = telLink();
  readonly ready = signal(false);
  /** Only one product is open at a time; the others are a single line. */
  readonly selectedId = signal<string | null>(null);
  /** The product being configured: the one the customer chose, or the only one there is. */
  readonly selected = computed(() => this.offers().find((o) => o.product.id === this.selectedId()) ?? null);

  readonly offers = computed<OfferView[]>(() =>
    this.catalogue().map(({ product: base, limits }) => {
      const r = this.referral();
      const product = r ? { ...base, ratePercent: discountedRate(base.ratePercent, r) } : base;
      const c = this.choices()[product.id] ?? { amount: limits.maxAmount, tenor: limits.maxTenor };
      const quote = quoteLoan(product, c.amount, c.tenor);
      return {
        product,
        limits,
        amount: c.amount,
        tenor: c.tenor,
        tenors: tenorChoices(limits, c.tenor),
        quote,
        apr: estimateApr(c.amount, quote.totalFees, quote.monthly, c.tenor),
      };
    }),
  );

  async ngOnInit(): Promise<void> {
    const employment = this.state.employment();
    const salary = this.state.salary();
    const eligibility = this.state.eligibility();
    // The route guards guarantee an approved eligibility result; the check only narrows the types.
    if (!employment || !salary || !eligibility) return;

    const pref = this.state.offerPreference();
    const catalogue: { product: Product; limits: Limits }[] = [];
    const choices: Record<string, Choice> = {};
    for (const product of productsFor(employment.type, salary.channel)) {
      const limits = offerLimits(product, {
        maxAmount: eligibility.maxEligibleAmount,
        maxTenorMonths: eligibility.tenorMonths,
      });
      if (!limits) continue;
      catalogue.push({ product, limits });
      choices[product.id] = { amount: limits.maxAmount, tenor: limits.maxTenor };
      // Remember what the customer chose last time, if it still fits.
      if (pref && pref.productId === product.id) {
        choices[product.id] = {
          amount: clampAmount(product, pref.amount, limits),
          tenor: Math.min(limits.maxTenor, Math.max(limits.minTenor, pref.tenorMonths)),
        };
      }
    }
    this.catalogue.set(catalogue);
    this.choices.set(choices);
    this.selectedId.set((pref && catalogue.find((c) => c.product.id === pref.productId)?.product.id) || catalogue[0]?.product.id || null);
    this.ready.set(true);
  }

  private setChoice(id: string, patch: Partial<Choice>): void {
    this.choices.update((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  }

  /** Applies a typed or stepped amount, rounding to the product step and range. */
  setAmount(o: OfferView, raw: number, announce = false): void {
    const out = resolveAmount(o.product, Number.isFinite(raw) ? raw : o.amount, o.limits);
    this.setChoice(o.product.id, { amount: out.amount });
    this.adjusted.update((a) => withEntry(a, o.product.id, announce ? out.adjustedTo : null));
    // Asking for more than the limit is only kept while it is typed; moving the slider or a chip clears it.
    this.askedMore.update((a) => withEntry(a, o.product.id, announce ? out.askedMore : null));
  }

  /** A WhatsApp message to an agent that already says what the customer wants and what their limit is. */
  agentLink(o: OfferView): string {
    const wanted = this.askedMore()[o.product.id] ?? o.amount;
    return whatsappLink(
      `Hello Princeps, I would like ${formatNaira(wanted)} on ${o.product.name} over ${o.tenor} months. My online limit is ${formatNaira(o.limits.maxAmount)}. Please help me.`,
    );
  }

  onAmountInput(o: OfferView, event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    el.value = digits ? Number(digits).toLocaleString('en-NG') : '';
  }

  commitAmount(o: OfferView, event: Event): void {
    const el = event.target as HTMLInputElement;
    const raw = Number(el.value.replace(/\D/g, ''));
    this.setAmount(o, raw || o.amount, true);
    el.value = Number(this.choices()[o.product.id].amount).toLocaleString('en-NG');
  }

  select(id: string): void {
    this.selectedId.set(id);
  }

  /** Only the chosen product is in the tab order; arrow keys move between the others. */
  productTab(id: string): number {
    return this.selectedId() === id ? 0 : -1;
  }

  setTenor(o: OfferView, tenor: number): void {
    this.setChoice(o.product.id, { tenor });
  }

  tenorTab(o: OfferView, tenor: number): number {
    return o.tenor === tenor ? 0 : -1;
  }

  modelKey(m: Product['interestModel']): string {
    if (m === 'Flat Rate') return 'step.offers.model.flat';
    if (m === 'Reducing Balance') return 'step.offers.model.reducing';
    return 'step.offers.model.percent';
  }

  frequencyKey(f: RepaymentFrequency): string {
    return `step.offers.frequency.${f}`;
  }

  finishLater(): void {
    void this.flow.go(APPLY.saved);
  }

  editDetails(): void {
    void this.flow.go(APPLY.employment);
  }

  pick(o: OfferView): void {
    this.state.setOffer({
      productId: o.product.id,
      productName: o.product.name,
      amount: o.amount,
      tenorMonths: o.tenor,
      ratePercent: o.product.ratePercent,
      interestModel: o.product.interestModel,
      monthlyRepayment: o.quote.monthly,
      fees: o.quote.fees,
      ...(this.referral() ? { referralCode: this.referral()?.code } : {}),
    });
    this.state.setOfferPreference({ productId: o.product.id, amount: o.amount, tenorMonths: o.tenor });
    void this.flow.go(APPLY.terms);
  }
}
