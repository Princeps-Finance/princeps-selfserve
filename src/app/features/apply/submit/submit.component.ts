import { IconComponent } from '../../../shared/icon.component';
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
  imports: [IconComponent, CheckboxComponent, TPipe, WizardProgressComponent],
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
  readonly formatNaira = formatNaira;

  readonly canSubmit = computed(() => this.agreed() && !this.submitting());

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
      // The photo and video were only needed for review; drop them from memory.
      this.state.setIdentityVerification(null);
      await this.flow.go(APPLY.status);
    } catch (err) {
      console.warn('Submit failed', err instanceof Error ? err.message : 'unknown');
      // Never invent an outcome: tell the user it did not go through and let them retry.
      this.state.setSubmission({ status: 'idle' });
      this.failed.set(true);
      this.toast.error(this.lang.t('submit.error.failed'), {
        action: { label: this.lang.t('common.retry'), run: () => void this.submit() },
      });
    } finally {
      this.submitting.set(false);
    }
  }
}
