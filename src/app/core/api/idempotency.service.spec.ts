import { describe, expect, it } from 'vitest';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  it('gives the same key to a retry of the same action', () => {
    const idem = new IdempotencyService();
    expect(idem.keyFor('mandate:p1:31966:12')).toBe(idem.keyFor('mandate:p1:31966:12'));
  });

  it('gives a different key when the action is different', () => {
    const idem = new IdempotencyService();
    expect(idem.keyFor('mandate:p1:31966:12')).not.toBe(idem.keyFor('mandate:p1:40000:12'));
  });

  it('produces valid UUIDs', () => {
    expect(new IdempotencyService().keyFor('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
