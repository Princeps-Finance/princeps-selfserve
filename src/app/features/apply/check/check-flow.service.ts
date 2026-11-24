import { Injectable, signal } from '@angular/core';
import { ApiError, apiError } from '../data-access/api-error';
import {
  EligibilityPreviewRequest,
  EligibilityPreviewResponse,
} from '../data-access/parity-contract';
import { ParityApi } from '../data-access/parity.api';

export type PreviewEmployment = EligibilityPreviewRequest['employment']['type'];
export type PreviewApplicant = Pick<EligibilityPreviewRequest, 'bank' | 'identity'> & {
  monthsLeftInService?: number;
};

@Injectable({ providedIn: 'root' })
export class CheckFlowService {
  readonly employmentType = signal<PreviewEmployment | null>(null);
  readonly mdaCode = signal('');
  readonly employerId = signal('');
  readonly result = signal<EligibilityPreviewResponse | null>(null);
  readonly pending = signal(false);
  readonly error = signal<ApiError | null>(null);

  chooseEmployment(type: PreviewEmployment): void {
    this.employmentType.set(type);
    if (type !== 'state') this.mdaCode.set('');
    if (type !== 'paramilitary') this.employerId.set('');
    this.result.set(null);
    this.error.set(null);
  }

  async evaluate(api: ParityApi, applicant: PreviewApplicant) {
    const employmentType = this.employmentType();
    if (!employmentType || this.pending()) return false;
    this.pending.set(true);
    this.error.set(null);
    try {
      const result = await api.previewEligibility({
        employment: {
          type: employmentType,
          ...(employmentType === 'state' ? { mdaCode: this.mdaCode() } : {}),
          ...(employmentType === 'paramilitary' ? { employerId: this.employerId() } : {}),
          ...(employmentType === 'nysc'
            ? { monthsLeftInService: applicant.monthsLeftInService }
            : {}),
        },
        bank: applicant.bank,
        identity: applicant.identity,
      });
      this.result.set(result);
      return true;
    } catch (error) {
      this.error.set(apiError(error));
      return false;
    } finally {
      this.pending.set(false);
    }
  }

  reset(): void {
    this.employmentType.set(null);
    this.mdaCode.set('');
    this.employerId.set('');
    this.result.set(null);
    this.error.set(null);
  }
}
