import { logWarn } from '../../../core/log';
import { MAX_UPLOAD_BYTES } from '../../../core/limits';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { IllustrationComponent } from '../../../core/ui/illustration.component';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { focusFirstInvalid } from '../../../core/a11y/focus';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { API_CLIENT, Bank, NG_BANKS } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { SelectFieldComponent, SelectOption } from '../../../core/ui/select-field.component';
import { APPLY } from '../../../core/flow/apply-routes';
import { DraftService } from '../../../core/application/draft.service';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

const MAX_BYTES = MAX_UPLOAD_BYTES;

/**
 * Private-sector applicants are not scored automatically. They share their bank statement and a
 * person at Princeps reviews it, so this screen collects the statement and sends it for review.
 */
@Component({
  selector: 'app-statement',
  imports: [IllustrationComponent, TPipe, WizardProgressComponent, ReactiveFormsModule, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './statement.component.html',
  styleUrl: './statement.component.css',
})
export class StatementComponent implements OnInit {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly drafts = inject(DraftService);

  readonly banks = signal<Bank[]>(NG_BANKS);
  readonly bankOptions = computed<SelectOption[]>(() => this.banks().map((b) => ({ value: b.code, label: b.name })));

  readonly form = new FormGroup({
    employer: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    bankCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly file = signal<File | null>(null);
  readonly fileError = signal<'type' | 'size' | 'missing' | null>(null);
  readonly attempted = signal(false);
  readonly submitting = signal(false);
  readonly failed = signal(false);
  readonly statusChanges = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  async ngOnInit(): Promise<void> {
    try { this.banks.set(await this.api.listBanks()); } catch { /* static list is already set */ }
  }

  invalid(name: 'employer' | 'bankCode'): true | null {
    return this.attempted() && this.form.controls[name].invalid ? true : null;
  }

  onFile(evt: Event): void {
    const f = (evt.target as HTMLInputElement).files?.[0] ?? null;
    this.fileError.set(null);
    if (!f) { this.file.set(null); return; }
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { this.file.set(null); this.fileError.set('type'); return; }
    if (f.size > MAX_BYTES) { this.file.set(null); this.fileError.set('size'); return; }
    this.file.set(f);
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.attempted.set(true);
    const f = this.file();
    if (!f) this.fileError.set('missing');
    const contact = this.state.contact();
    const bvn = this.state.bvn();
    if (this.form.invalid || !f || !contact || !bvn) {
      setTimeout(() => (this.form.invalid ? focusFirstInvalid() : document.getElementById('statement-file')?.focus()));
      return;
    }
    this.submitting.set(true);
    this.failed.set(false);
    try {
      const v = this.form.getRawValue();
      const res = await this.api.submitStatementReview({
        contact, bvn: bvn.value, employer: v.employer.trim(), bankCode: v.bankCode, fileName: f.name, sizeBytes: f.size,
      });
      this.state.setSubmission({ status: 'received', referenceId: res.referenceId });
      this.drafts.clear();
      await this.flow.go(APPLY.status);
    } catch (err) {
        logWarn('statement step 1 failed', err);
this.failed.set(true);
    } finally {
      this.submitting.set(false);
    }
  }
}
