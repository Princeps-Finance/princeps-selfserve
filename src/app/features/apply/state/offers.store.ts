import { Subject } from 'rxjs';
import { DestroyRef, computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { ApplicationApi } from '../data-access/application.api';
import { ApplicationSession } from '../../../core/session/application-session.service';
import { ApiError, apiError } from '../data-access/api-error';
import * as ApplicationContract from '../data-access/application-contract';

export const OffersStore = signalStore(
  { providedIn: 'root' },
  withState({
    result: null as ApplicationContract.OffersResponseDto | null,
    quote: null as ApplicationContract.QuoteResponseDto | null,
    quoteKey: '',
    loadingOffers: false,
    quoting: false,
    error: null as ApiError | null,
  }),
  withComputed(({ loadingOffers, quoting }) => ({
    loading: computed(() => loadingOffers() || quoting()),
  })),
  withMethods((store, api = inject(ApplicationApi), session = inject(ApplicationSession)) => {
    let sequence = 0;
    const quoteCancelled = new Subject<void>();
    function cancelQuote() {
      ++sequence;
      quoteCancelled.next();
    }
    inject(DestroyRef).onDestroy(() => {
      cancelQuote();
      quoteCancelled.complete();
    });
    return {
      clear() {
        cancelQuote();
        patchState(store, {
          result: null,
          quote: null,
          quoteKey: '',
          loadingOffers: false,
          quoting: false,
          error: null,
        });
      },
      invalidateQuote() {
        cancelQuote();
        patchState(store, { quote: null, quoteKey: '', quoting: false, error: null });
      },
      async load(check = false) {
        const generation = session.generation();
        patchState(store, { loadingOffers: true, error: null });
        try {
          const result = await (check ? api.checkEligibility() : api.getOffers());
          if (generation === session.generation()) patchState(store, { result });
        } catch (error) {
          if (generation === session.generation())
            patchState(store, { result: null, error: apiError(error) });
        } finally {
          if (generation === session.generation()) patchState(store, { loadingOffers: false });
        }
      },
      async requestQuote(input: ApplicationContract.QuoteDto) {
        cancelQuote();
        const request = sequence;
        const generation = session.generation();
        patchState(store, {
          quote: null,
          quoteKey: JSON.stringify(input),
          quoting: true,
          error: null,
        });
        try {
          const quote = await api.requestQuote(input, quoteCancelled);
          if (request === sequence && generation === session.generation())
            patchState(store, { quote });
        } catch (error) {
          if (request === sequence && generation === session.generation())
            patchState(store, { error: apiError(error) });
        } finally {
          if (request === sequence && generation === session.generation())
            patchState(store, { quoting: false });
        }
      },
    };
  }),
  withHooks((store, session = inject(ApplicationSession)) => ({
    onInit() {
      const subscription = session.cancelled.subscribe(() => store.clear());
      inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    },
  })),
);
