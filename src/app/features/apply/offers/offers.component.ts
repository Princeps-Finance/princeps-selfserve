import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../../core/i18n/t.pipe';
import { RadioGroupDirective } from '../../../core/a11y/radio-group.directive';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { Product, RepaymentFrequency, productsFor } from '../../../core/products/products';
import { LoanQuote, clampAmount, offerLimits, quoteLoan } from '../../../../shared/pricing';
import { formatNaira } from '../../../core/money.util';
import { telLink, whatsappLink } from '../../../core/support';

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
}

interface Choice {
  amount: number;
  tenor: number;
}

@Component({
  selector: 'app-offers',
  imports: [TPipe, WizardProgressComponent, RadioGroupDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offers.component.html',
  styleUrl: './offers.component.css',
})
export class OffersComponent implements OnInit {
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);

  private readonly catalogue = signal<{ product: Product; limits: Limits }[]>([]);
  /** What the customer has chosen per product. Starts at the most they are eligible for. */
  private readonly choices = signal<Record<string, Choice>>({});
  /** Set when an amount typed by the customer had to be adjusted to fit. */
  readonly adjusted = signal<Record<string, number>>({});

  readonly formatNaira = formatNaira;
  readonly justChecking = computed(() => this.state.intent() === 'check');
  readonly reviewRequired = computed(() => this.state.eligibility()?.decision === 'review');
  readonly whatsapp = whatsappLink('Hello Princeps, I could not find a loan that fits my details and would like help.');
  readonly tel = telLink();
  readonly ready = signal(false);

  readonly offers = computed<OfferView[]>(() =>
    this.catalogue().map(({ product, limits }) => {
      const c = this.choices()[product.id] ?? { amount: limits.maxAmount, tenor: limits.maxTenor };
      const tenors: number[] = [];
      for (let t = limits.minTenor; t <= limits.maxTenor; t++) tenors.push(t);
      return { product, limits, amount: c.amount, tenor: c.tenor, tenors, quote: quoteLoan(product, c.amount, c.tenor) };
    }),
  );

  async ngOnInit(): Promise<void> {
    const employment = this.state.employment();
    const salary = this.state.salary();
    const eligibility = this.state.eligibility();
    if (!employment || !salary || !eligibility || eligibility.decision === 'declined') {
      await this.router.navigateByUrl('/apply/eligibility');
      return;
    }

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
    this.ready.set(true);
  }

  private setChoice(id: string, patch: Partial<Choice>): void {
    this.choices.update((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  }

  /** Applies a typed or stepped amount, rounding to the product step and range. */
  setAmount(o: OfferView, raw: number, announce = false): void {
    const next = clampAmount(o.product, Number.isFinite(raw) ? raw : o.amount, o.limits);
    this.setChoice(o.product.id, { amount: next });
    this.adjusted.update((a) => {
      const copy = { ...a };
      if (announce && next !== raw) copy[o.product.id] = next;
      else delete copy[o.product.id];
      return copy;
    });
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

  onSlider(o: OfferView, event: Event): void {
    this.setAmount(o, Number((event.target as HTMLInputElement).value));
  }

  nudge(o: OfferView, direction: 1 | -1): void {
    this.setAmount(o, o.amount + direction * o.product.amountStep);
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
    void this.router.navigateByUrl('/apply/saved');
  }

  editDetails(): void {
    void this.router.navigateByUrl('/apply/employment');
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
    });
    this.state.setOfferPreference({ productId: o.product.id, amount: o.amount, tenorMonths: o.tenor });
    void this.router.navigateByUrl('/apply/terms');
  }
}
