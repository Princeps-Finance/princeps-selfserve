import { AnimatedIconComponent } from '../../../shared/animated-icon.component';
import { HelpLinksComponent } from '../../../shared/help-links.component';
import { ApiUnavailableError } from '../../../core/api/http-api-client';
import { CheckboxComponent } from '../../../shared/checkbox.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { formatNaira } from '../../../core/money.util';
import { buildSubmitPayload } from '../../../core/application/submission-payload';
import { LangService } from '../../../core/i18n/lang.service';
import { DraftService } from '../../../core/application/draft.service';
import { ToastService } from '../../../core/toast/toast.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

@Component({
  selector: 'app-submit',
  imports: [AnimatedIconComponent, CheckboxComponent, HelpLinksComponent, TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './submit.component.html',
  styleUrl: './submit.component.css',
})
export class SubmitComponent {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
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
  /** Which message to show for a failed send: offline, a known problem the server named, or the general one. */
  readonly failureKey = signal('submit.error.failed');
  readonly formatNaira = formatNaira;

  readonly canSubmit = computed(() => this.agreed() && !this.submitting());

  toggleAgree(v: boolean): void { this.agreed.set(v);
    if (v) this.attempted.set(false); }

  /** Says what went wrong in terms the customer can act on. Codes are what the API sends back for known problems. */
  private failureFor(err: unknown): string {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'submit.error.offline';
    const code = err instanceof ApiUnavailableError ? err.code : '';
    if (/duplicate|already|in-progress/.test(code)) return 'submit.error.duplicate';
    if (/active-loan|exposure/.test(code)) return 'submit.error.activeLoan';
    if (/closed|cancel|expired|offer-changed/.test(code)) return 'submit.error.changed';
    return 'submit.error.failed';
  }

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
      const built = buildSubmitPayload(this.state, this.state.ensureSubmissionKey());
      if (!built.ok) throw new Error(`Application incomplete: ${built.missing}`);
      const res = await this.api.submitApplication(built.payload);
      this.state.setSubmission({
        status: 'received',
        submittedAt: new Date().toISOString(),
        referenceId: res.referenceId,
        manualReview: this.state.eligibility()?.decision === 'review',
      });
      this.drafts.clear();
      // Success screen first; the photo and video were only needed for review and are dropped once it is open.
      const arrived = await this.flow.go(APPLY.status);
      // The application is in and its receipt is saved: if the router could not open the screen, load it fresh.
      if (!arrived) window.location.assign(APPLY.status);
      this.state.setIdentityVerification(null);
    } catch (err) {
      console.warn('Submit failed', err instanceof Error ? err.message : 'unknown');
      // Never invent an outcome: tell the user it did not go through and let them retry.
      this.state.setSubmission({ status: 'idle' });
      this.failureKey.set(this.failureFor(err));
      this.failed.set(true);
      this.toast.error(this.lang.t(this.failureKey()), {
        action: { label: this.lang.t('common.retry'), run: () => void this.submit() },
      });
    } finally {
      this.submitting.set(false);
    }
  }
}
