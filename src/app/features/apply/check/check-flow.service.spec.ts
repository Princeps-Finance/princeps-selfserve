import { ApiError } from '../data-access/api-error';
import type { EligibilityPreviewResponse } from '../data-access/parity-contract';
import type { ParityApi } from '../data-access/parity.api';
import { CheckFlowService } from './check-flow.service';

const approved: EligibilityPreviewResponse = {
  decision: 'APPROVE',
  maximumAmount: 250_000,
  maximumTenor: 6,
  reasons: [],
  eligibleProducts: [
    {
      productId: 'product-1',
      name: 'IPPIS Loan',
      category: 'state',
      minAmount: 50_000,
      maxAmount: 250_000,
      suggestedAmount: 250_000,
      defaultTenorMonths: 6,
      tenorOptions: [3, 6],
      calculation: {
        loanAmount: 250_000,
        duration: 6,
        rate: 4.5,
        interest: 67_500,
        fees: [],
        totalRepayment: 317_500,
        installmentRepayment: 52_916.67,
        schedule: [],
      },
    },
  ],
};

describe('CheckFlowService', () => {
  it('submits the selected employment and state with the salary details', async () => {
    const previewEligibility = vi.fn().mockResolvedValue(approved);
    const api = { previewEligibility } as unknown as ParityApi;
    const service = new CheckFlowService();

    service.chooseEmployment('state');
    service.mdaCode.set('lagos-state-government');

    await expect(
      service.evaluate(api, {
        bank: {
          bankCode: '058',
          accountNumber: '0123456789',
          accountName: 'ADA GRACE OKAFOR',
          serviceNumber: '123456',
        },
        identity: { bvn: '22349353546', firstName: 'Ada', lastName: 'Okafor' },
      }),
    ).resolves.toBe(true);

    expect(previewEligibility).toHaveBeenCalledWith({
      employment: { type: 'state', mdaCode: 'lagos-state-government' },
      bank: {
        bankCode: '058',
        accountNumber: '0123456789',
        accountName: 'ADA GRACE OKAFOR',
        serviceNumber: '123456',
      },
      identity: { bvn: '22349353546', firstName: 'Ada', lastName: 'Okafor' },
    });
    expect(service.result()).toEqual(approved);
    expect(service.error()).toBeNull();
    expect(service.pending()).toBe(false);
  });

  it('keeps the customer on the form and exposes a safe API error when preview fails', async () => {
    const failure = new ApiError('PREVIEW_UNAVAILABLE', 'Try again in a moment.', 503);
    const api = {
      previewEligibility: vi.fn().mockRejectedValue(failure),
    } as unknown as ParityApi;
    const service = new CheckFlowService();

    service.chooseEmployment('federal');

    await expect(
      service.evaluate(api, {
        bank: {
          bankCode: '058',
          accountNumber: '0123456789',
          accountName: 'ADA GRACE OKAFOR',
        },
        identity: { bvn: '22349353546', firstName: 'Ada', lastName: 'Okafor' },
      }),
    ).resolves.toBe(false);

    expect(service.result()).toBeNull();
    expect(service.error()).toBe(failure);
    expect(service.pending()).toBe(false);
  });

  it('does not call the API before an employment type is selected', async () => {
    const previewEligibility = vi.fn();
    const api = { previewEligibility } as unknown as ParityApi;
    const service = new CheckFlowService();

    await expect(
      service.evaluate(api, {
        bank: {
          bankCode: '058',
          accountNumber: '0123456789',
          accountName: 'ADA GRACE OKAFOR',
        },
        identity: { bvn: '22349353546', firstName: 'Ada', lastName: 'Okafor' },
      }),
    ).resolves.toBe(false);
    expect(previewEligibility).not.toHaveBeenCalled();
  });
});
