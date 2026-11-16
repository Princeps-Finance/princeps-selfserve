import { HttpErrorResponse } from '@angular/common/http';
import { z } from 'zod/mini';
import { $ZodError } from 'zod/v4/core';

const detailsSchema = z.object({
  retryAfterSeconds: z.optional(z.number().check(z.nonnegative())),
  attemptsLeft: z.optional(z.int().check(z.nonnegative())),
  errors: z.optional(z.array(z.string())),
  reasons: z.optional(z.array(z.string())),
  missing: z.optional(z.array(z.string())),
  maxAmountForTenor: z.optional(z.number().check(z.nonnegative())),
});

type ApiErrorDetails = z.infer<typeof detailsSchema>;

const errorBody = z.object({
  code: z.optional(z.string()),
  message: z.optional(z.union([z.string(), z.array(z.string())])),
  retryAfterSeconds: z.optional(z.number().check(z.nonnegative())),
  data: z.optional(z.unknown()),
});

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
    readonly retryAfterSeconds?: number,
    readonly details: ApiErrorDetails = {},
  ) {
    super(message);
  }
}

export function apiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpErrorResponse) {
    const parsed = errorBody.safeParse(error.error);
    const body = parsed.success ? parsed.data : undefined;
    const parsedDetails = detailsSchema.safeParse(body?.data ?? error.error);
    const details = parsedDetails.success ? parsedDetails.data : {};
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    return new ApiError(
      body?.code ?? (error.status === 0 ? 'NETWORK_ERROR' : 'REQUEST_FAILED'),
      message ?? 'We could not complete this request. Please try again.',
      error.status,
      details.retryAfterSeconds ?? body?.retryAfterSeconds,
      details,
    );
  }
  if (error instanceof $ZodError)
    return new ApiError(
      'INVALID_RESPONSE',
      'The service returned an unexpected response. Please try again.',
    );
  return new ApiError('UNAVAILABLE', 'We could not complete this request. Please try again.');
}
