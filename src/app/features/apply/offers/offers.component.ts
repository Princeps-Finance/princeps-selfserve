import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { RouterLink } from '@angular/router';
import { HelpLinksComponent } from '../../support/help-links.component';
import { IllustrationComponent } from '../../../shared/components/illustration.component';
import { WizardProgressComponent } from '../wizard-progress.component';
import { AnimatedIconComponent } from '../../../shared/components/animated-icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, tap } from 'rxjs';
import { ApplicationStore } from '../state/application.store';
import { OffersStore } from '../state/offers.store';
import { ApplicationApi } from '../data-access/application.api';
import { ButtonDirective } from '@princeps-finance/ui';
import { InputDirective } from '../../../shared/components/input/input.directive';
import { CurrencyInputDirective } from '../../../shared/components/input/currency-input.directive';
import { SelectFieldComponent } from '../../../shared/components/select/select-field.component';
import { AmountSliderComponent } from '../../../shared/components/amount-slider.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { formatNaira } from '../money';
import * as ApplicationContract from '../data-access/application-contract';
@Component({
  selector: 'app-offers-v2',
  imports: [
    SpinnerComponent,
    RouterLink,
    HelpLinksComponent,
    IllustrationComponent,
    WizardProgressComponent,
    AnimatedIconComponent,
    ReactiveFormsModule,
    ButtonDirective,
    InputDirective,
    CurrencyInputDirective,
    SelectFieldComponent,
    AmountSliderComponent,
    TPipe,
  ],
  templateUrl: './offers.component.html',
  styleUrl: '../apply-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffersComponent {
  readonly store = inject(ApplicationStore);
  readonly offers = inject(OffersStore);
  readonly api = inject(ApplicationApi);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly page = inject(ActivatedRoute).snapshot.data['page'] as string;
  readonly selected = signal<ApplicationContract.EligibleOfferDto | null>(null);
  readonly locked = signal<ApplicationContract.LockedOfferDto | null>(null);
  readonly now = signal(Date.now());
  readonly declined = computed(
    () =>
      this.offers.result()?.outcome === 'DECLINE' ||
      ['NOT_ELIGIBLE', 'NO_ELIGIBLE_PRODUCTS'].includes(this.offers.error()?.code ?? ''),
  );
  readonly expired = computed(
    () =>
      this.offers.error()?.status === 410 ||
      (!!this.offers.result() && Date.parse(this.offers.result()!.expiresAt) <= this.now()),
  );
  readonly tenorOptions = computed(() =>
    (this.selected()?.tenorOptions ?? []).map((value) => ({
      value: String(value),
      label: String(value),
    })),
  );
  readonly form = new FormGroup({
    amount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(1)],
    }),
    tenor: new FormControl('', { nonNullable: true, validators: Validators.required }),
    referralCode: new FormControl('', { nonNullable: true }),
  });
  readonly money = formatNaira;
  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroy.onDestroy(() => {
      clearInterval(timer);
      this.offers.invalidateQuote();
    });
    this.form.valueChanges
      .pipe(
        tap(() => this.offers.invalidateQuote()),
        debounceTime(350),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const input = this.input();
        if (input) void this.offers.requestQuote(input);
      });
    if (this.page === 'eligibility') {
      const existing = this.store.application()?.eligibility;
      // Arriving straight from a salary save always re-runs the check against the new details.
      const salaryJustSaved =
        this.router.currentNavigation()?.extras.state?.['checkEligibility'] === true;
      void this.check(
        salaryJustSaved ||
          !existing ||
          existing.expired ||
          Date.parse(existing.expiresAt) <= Date.now(),
      );
    }
    if (this.page === 'offers') void this.offers.load();
    if (this.page === 'terms') void this.loadLocked();
  }
  async check(refresh = true) {
    if (this.offers.loading()) return;
    this.selected.set(null);
    this.offers.invalidateQuote();
    await this.offers.load(refresh);
    if (this.destroy.destroyed) return;
    if (
      this.offers.result() &&
      this.offers.result()!.outcome !== 'DECLINE' &&
      this.offers.result()!.offers.length
    ) {
      await this.store.run('refresh', () => this.store.refresh());
      if (!this.destroy.destroyed) await this.router.navigateByUrl('/apply/offers');
    }
  }
  retry() {
    const value = this.input();
    if (value && !this.expired()) void this.offers.requestQuote(value);
    else void this.offers.load();
  }
  choose(offer: ApplicationContract.EligibleOfferDto) {
    this.selected.set(offer);
    this.form.controls.amount.setValidators([
      Validators.required,
      Validators.min(offer.minAmount),
      Validators.max(offer.maxAmount),
    ]);
    this.form.markAsUntouched();
    this.form.patchValue({
      amount: offer.suggestedAmount,
      tenor: String(offer.defaultTenorMonths),
    });
  }
  input(): ApplicationContract.QuoteDto | null {
    const selected = this.selected(),
      value = this.form.getRawValue();
    if (
      !selected ||
      value.amount === null ||
      this.form.invalid ||
      !selected.tenorOptions.includes(Number(value.tenor))
    )
      return null;
    return {
      productId: selected.productId,
      amount: value.amount,
      tenorMonths: Number(value.tenor),
      ...(value.referralCode.trim() ? { referralCode: value.referralCode.trim() } : {}),
    };
  }
  async select() {
    this.form.markAllAsTouched();
    const input = this.input();
    if (
      !input ||
      this.expired() ||
      !this.offers.quote()?.eligible ||
      this.offers.quoteKey() !== JSON.stringify(input)
    )
      return;
    if (
      (await this.store.save('select', () => this.api.selectOffer(input))) &&
      !this.destroy.destroyed
    )
      await this.router.navigateByUrl('/apply/terms');
  }
  async loadLocked() {
    const offer = await this.store.run('locked', () => this.api.getOffer());
    if (offer && !this.destroy.destroyed) this.locked.set(offer);
  }
  async acceptTerms() {
    if ((await this.store.save('terms', () => this.api.completeTerms())) && !this.destroy.destroyed)
      await this.router.navigateByUrl(this.store.nextRoute());
  }
  scheduleEntries(row: Record<string, unknown>) {
    return Object.entries(row).filter(
      (entry): entry is [string, string | number] =>
        typeof entry[1] === 'string' || typeof entry[1] === 'number',
    );
  }
}
