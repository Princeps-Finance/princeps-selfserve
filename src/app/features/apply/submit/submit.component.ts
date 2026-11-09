import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { formatNaira } from '../../../core/money.util';
import { APP_VERSION } from '../../../core/app-version';
import { LangService } from '../../../core/i18n/lang.service';
import { DraftService } from '../../../core/application/draft.service';
import { ToastService } from '../../../core/toast/toast.service';

function isLoanEmployment(t: string): t is 'government' | 'paramilitary' | 'corper' {
  return t === 'government' || t === 'paramilitary' || t === 'corper';
}

@Component({
  selector: 'app-submit',
  imports: [TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './submit.component.html',
  styleUrl: './submit.component.css',
})
export class SubmitComponent {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly drafts = inject(DraftService);
  private readonly lang = inject(LangService);

  readonly contact = this.state.contact;
  readonly employment = this.state.employment;
  readonly offer = this.state.offer;
  readonly agreed = signal(false);
  readonly attempted = signal(false);
  readonly submitting = signal(false);
  readonly failed = signal(false);
  readonly formatNaira = formatNaira;

  readonly canSubmit = computed(() => this.agreed() && !this.submitting());

  constructor() {
    if (!this.state.bvn()?.verified || !this.state.offer()) {
      void this.router.navigateByUrl('/apply/documents');
    }
  }

  toggleAgree(v: boolean): void { this.agreed.set(v);
    if (v) this.attempted.set(false); }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    if (!this.agreed()) {
      this.attempted.set(true);
      document.querySelector<HTMLElement>('.agree input')?.focus();
      return;
    }
    if (this.state.submission().status === 'submitting') return;

    this.submitting.set(true);
    this.failed.set(false);
    this.state.setSubmission({ status: 'submitting' });
    try {
      const contact = this.state.contact()!;
      const employment = this.state.employment()!;
      const offer = this.state.offer()!;
      const bvnDraft = this.state.bvn()!;
      const bvn = bvnDraft.value;
      const salary = this.state.salary();
      const consent = this.state.consent();
      if (!consent) throw new Error('consent missing');
      const profile = this.state.profile();

      if (!salary || !isLoanEmployment(employment.type)) throw new Error('incomplete application');
      const channel = salary.channel;
      const employmentType = employment.type;
      const res = await this.api.submitApplication({
        contact: { phone: contact.phone, email: contact.email },
        employment: { type: employment.type },
        offer: { productId: offer.productId, amount: offer.amount, tenorMonths: offer.tenorMonths },
        bvn,
        loan: {
          productId: offer.productId,
          appVersion: APP_VERSION,
          consentVersion: consent.version,
          consentAt: consent.acceptedAt,
          manualReview: this.state.eligibility()?.decision === 'review',
          mandateReference: this.state.mandate()?.reference ?? null,
          borrowerBvn: bvn,
          borrowerName: profile?.fullName ?? bvnDraft.matchedName ?? 'Unknown',
          borrowerPhone: contact.phone,
          amountKobo: Math.round(offer.amount * 100),
          tenorMonths: offer.tenorMonths,
          monthlyRepaymentKobo: Math.round(offer.monthlyRepayment * 100),
          interestModel: offer.interestModel,
          ratePercent: offer.ratePercent,
          channel,
          bankCode: salary.bankCode || null,
          accountNumber: salary.accountNumber || null,
          ippisNumber: salary.ippisNumber || null,
          employmentType,
          employer: salary.paramilitaryEmployer ?? null,
        },
      });
      this.state.setSubmission({
        status: 'received',
        submittedAt: new Date().toISOString(),
        referenceId: res.referenceId,
        manualReview: this.state.eligibility()?.decision === 'review',
      });
      this.drafts.clear();
      // The photo and video were only needed for review; drop them from memory.
      this.state.setIdentityVerification(null);
      await this.router.navigateByUrl('/apply/status');
    } catch {
      // Never invent an outcome: tell the user it did not go through and let them retry.
      this.state.setSubmission({ status: 'idle' });
      this.failed.set(true);
      this.toast.error(this.lang.t('submit.error.failed'));
    } finally {
      this.submitting.set(false);
    }
  }
}
