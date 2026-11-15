import { describe, expect, it } from 'vitest';
import { pricingProductById } from '../../../../shared/pricing';
import { resolveAmount } from './amount-request';

const product = pricingProductById('ippis-standard')!;
const limits = { minAmount: 50_000, maxAmount: 300_000 };

describe('resolveAmount', () => {
  it('keeps an amount that fits', () => {
    expect(resolveAmount(product, 150_000, limits)).toEqual({ amount: 150_000, askedMore: null, adjustedTo: null });
  });

  it('keeps the offer at the limit and remembers that more was asked for', () => {
    expect(resolveAmount(product, 800_000, limits)).toEqual({ amount: 300_000, askedMore: 800_000, adjustedTo: null });
  });

  it('raises an amount below the minimum and says what was used', () => {
    expect(resolveAmount(product, 10_000, limits)).toEqual({ amount: 50_000, askedMore: null, adjustedTo: 50_000 });
  });

  it('rounds an amount that is off a step', () => {
    const out = resolveAmount(product, 152_300, limits);
    expect(out.amount % product.amountStep).toBe(0);
    expect(out.askedMore).toBeNull();
  });
});
