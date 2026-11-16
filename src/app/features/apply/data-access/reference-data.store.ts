import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { z } from 'zod/mini';
import { apiOrigin } from '../../../core/api-origin';
import * as ApplicationContract from './application-contract';
import { parseApiResponse } from './api-response';
import { apiError } from './api-error';
const envelope = z.object({ expires: z.number(), value: z.unknown() });
const DAY = 86_400_000;
export const ReferenceDataStore = signalStore(
  { providedIn: 'root' },
  withState({ entries: {} as Record<string, { expires: number; value: unknown }> }),
  withMethods((store, http = inject(HttpClient)) => {
    const requests = new Map<string, Promise<unknown>>();
    async function load<T>(path: string, schema: z.ZodMiniType<T>, ttl: number): Promise<T> {
      const origin = apiOrigin();
      const key = `princeps.public.v2:${origin}:${path}`;
      let cached = store.entries()[key];
      if (!cached) {
        try {
          const result = envelope.safeParse(JSON.parse(localStorage.getItem(key) ?? 'null'));
          if (result.success) cached = { expires: result.data.expires, value: result.data.value };
        } catch {
          /* An unavailable cache never blocks the API. */
        }
      }
      if (cached && cached.expires > Date.now()) {
        const valid = schema.safeParse(cached.value);
        if (valid.success) return valid.data;
      }
      const pending = requests.get(key);
      if (pending) return schema.parse(await pending);
      const request = firstValueFrom(
        http.get<unknown>(`${origin}/api/v2/${path}`).pipe(timeout(20_000)),
      )
        .then((value) => {
          const parsed = parseApiResponse(value, schema),
            entry = { value: parsed, expires: Date.now() + ttl };
          patchState(store, { entries: { ...store.entries(), [key]: entry } });
          try {
            localStorage.setItem(key, JSON.stringify(entry));
          } catch {
            /* Memory cache still works. */
          }
          return parsed;
        })
        .catch((error) => {
          throw apiError(error);
        })
        .finally(() => requests.delete(key));
      requests.set(key, request);
      return request;
    }
    return {
      banks: () => load('banks', z.array(ApplicationContract.BankItemDtoSchema), DAY),
      states: () => load('states', z.array(ApplicationContract.StateItemDtoSchema), 7 * DAY),
      lgas: (state: string) =>
        load(`states/${encodeURIComponent(state)}/lgas`, z.array(z.string()), 7 * DAY),
      employmentTypes: () =>
        load(
          'employment-types',
          z.array(ApplicationContract.EmploymentTypeItemDtoSchema),
          15 * 60_000,
        ),
      mdas: () => load('mdas', z.array(ApplicationContract.MdaItemDtoSchema), 15 * 60_000),
      employers: () =>
        load(
          'paramilitary/employers',
          z.array(ApplicationContract.EmployerItemDtoSchema),
          15 * 60_000,
        ),
    };
  }),
);
