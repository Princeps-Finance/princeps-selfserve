import { z } from 'zod/mini';

const envelope = z.object({
  status: z.literal('success'),
  statusCode: z.int().check(z.minimum(200), z.maximum(299)),
  code: z.string(),
  message: z.optional(z.string()),
  timestamp: z.optional(z.string()),
  data: z.unknown(),
});

export function parseApiResponse<T>(value: unknown, schema: z.ZodMiniType<T>): T {
  // Keep accepting bare DTOs while environments move to the updated contract.
  if (typeof value !== 'object' || value === null || !('statusCode' in value))
    return schema.parse(value);
  const response = envelope.parse(value);
  return schema.parse(response.data);
}
