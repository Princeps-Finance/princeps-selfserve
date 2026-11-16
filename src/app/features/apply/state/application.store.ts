import { computed, DestroyRef, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { ApplicationSession } from '../../../core/session/application-session.service';
import { ApiError, apiError } from '../data-access/api-error';
import { ApplicationApi } from '../data-access/application.api';
import * as ApplicationContract from '../data-access/application-contract';

export const stepRoutes: Record<string, string> = {
  verification: 'verify',
  profile: 'profile',
  employment: 'employment',
  salary: 'salary',
  eligibility: 'eligibility',
  offer: 'offers',
  terms: 'terms',
  documents: 'documents',
  identity: 'verify-identity',
  offerLetter: 'offer-letter',
  mandates: 'mandate',
  submit: 'submit',
};
interface OtpDelivery {
  contactId: string;
  phoneNumber?: string;
}

const initial = {
  otpDelivery: null as OtpDelivery | null,
  resendAt: 0,
  application: null as ApplicationContract.ApplicationViewDto | null,
  pending: {} as Record<string, boolean>,
  errors: {} as Record<string, ApiError | null>,
};
export const ApplicationStore = signalStore(
  { providedIn: 'root' },
  withState(initial),
  withComputed((store, session = inject(ApplicationSession)) => ({
    verified: session.verified,
    nextRoute: computed(() => {
      const app = store.application();
      if (!app) return '/apply/bvn';
      if (app.status !== 'DRAFT') return '/apply/status';
      return '/apply/' + (stepRoutes[app.suggestedNext ?? 'submit'] ?? 'profile');
    }),
  })),
  withMethods((store, api = inject(ApplicationApi), session = inject(ApplicationSession)) => ({
    async run<T>(key: string, work: () => Promise<T>): Promise<T | null> {
      if (store.pending()[key]) return null;
      const generation = session.generation();
      patchState(store, {
        pending: { ...store.pending(), [key]: true },
        errors: { ...store.errors(), [key]: null },
      });
      try {
        const result = await work();
        return generation === session.generation() ? result : null;
      } catch (error) {
        if (generation === session.generation())
          patchState(store, { errors: { ...store.errors(), [key]: apiError(error) } });
        return null;
      } finally {
        if (generation === session.generation())
          patchState(store, { pending: { ...store.pending(), [key]: false } });
      }
    },
    setApplication(app: ApplicationContract.ApplicationViewDto) {
      patchState(store, { application: ApplicationContract.ApplicationViewDtoSchema.parse(app) });
    },
    reset() {
      session.reset();
    },
    clearError(key: string) {
      patchState(store, { errors: { ...store.errors(), [key]: null } });
    },
    async refresh() {
      const generation = session.generation();
      const app = await api.getApplication();
      if (generation === session.generation()) patchState(store, { application: app });
      return app;
    },
  })),
  withMethods((store, api = inject(ApplicationApi), session = inject(ApplicationSession)) => ({
    async start(body: ApplicationContract.StartApplicationDto): Promise<boolean> {
      const app = await store.run('start', () => api.startApplication(body));
      if (!app) return false;
      session.establish(app.id, app.resumeToken);
      patchState(store, {
        application: ApplicationContract.ApplicationViewDtoSchema.parse(app),
        pending: {},
        errors: {},
      });
      return true;
    },
    async sendCode(delivery: OtpDelivery): Promise<boolean> {
      if (store.pending()['send'] || store.pending()['verify'] || Date.now() < store.resendAt())
        return false;
      const result = await store.run('send', () =>
        api.sendOtp(delivery.contactId, delivery.phoneNumber),
      );
      if (!result) {
        const seconds = store.errors()['send']?.retryAfterSeconds;
        if (seconds) patchState(store, { resendAt: Date.now() + seconds * 1000 });
        return false;
      }
      patchState(store, {
        otpDelivery: delivery,
        resendAt: Date.now() + result.resendAfterSeconds * 1000,
      });
      return true;
    },
    async verify(code: string): Promise<boolean> {
      const app = await store.run('verify', () => api.verifyOtp(code));
      if (!app) return false;
      store.setApplication(app);
      if (app.otpVerified) {
        patchState(store, { otpDelivery: null, resendAt: 0 });
        session.markVerified();
      }
      return app.otpVerified;
    },
    async save(key: string, action: () => Promise<unknown>): Promise<boolean> {
      return !!(await store.run(key, async () => {
        await action();
        return store.refresh();
      }));
    },
  })),
  withHooks((store, session = inject(ApplicationSession)) => ({
    onInit() {
      const subscription = session.cancelled.subscribe(() => patchState(store, initial));
      inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    },
  })),
);
