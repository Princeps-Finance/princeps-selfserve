import { clampAmount } from '../../../../shared/pricing';

export interface AmountLimits {
  minAmount: number;
  maxAmount: number;
}

/** What to do with an amount the customer typed. */
export interface AmountOutcome {
  /** The amount to use: always inside the limits and on a valid step. */
  amount: number;
  /** Set when they asked for more than the limit allows: the offer stays at the limit and an agent can help. */
  askedMore: number | null;
  /** Set when the amount was nudged to fit (below the minimum or off a step), so we can say what we used. */
  adjustedTo: number | null;
}

/**
 * Turns a typed amount into the amount used. A request above the limit is never silently cut down: it is
 * reported as `askedMore` so the screen can offer to talk to an agent about a larger loan.
 */
export function resolveAmount(
  product: Parameters<typeof clampAmount>[0],
  typed: number,
  limits: AmountLimits,
): AmountOutcome {
  const amount = clampAmount(product, typed, limits);
  if (typed > limits.maxAmount) return { amount, askedMore: typed, adjustedTo: null };
  return { amount, askedMore: null, adjustedTo: amount !== typed ? amount : null };
}
