import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TPipe } from '../../core/i18n/t.pipe';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { ButtonDirective } from '@princeps-finance/ui';
import { ApplicationApi } from './data-access/application.api';
import { OffersStore } from './state/offers.store';
import { ApplicationStore } from './state/application.store';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { filter, map, of, startWith, switchMap, takeWhile, timer } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { LanguageMenuComponent } from './language-menu.component';
import { APPLY } from './apply-routes';
import { BackButtonComponent } from './back-button.component';
import { ReadAloudComponent } from '../../shared/components/read-aloud.component';
import { BrandLogoComponent } from '../../shared/components/brand-logo.component';
import { LoanSummaryComponent } from './loan-summary.component';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle.component';

/** The steps after the review, where the chosen amount and period stay one tap away. */
const SUMMARY_ROUTES = new Set<string>([
  APPLY.nin,
  APPLY.documents,
  APPLY.offerLetter,
  APPLY.verifyIdentity,
  APPLY.mandate,
  APPLY.submit,
]);

const NO_BACK_ROUTES = new Set<string>([APPLY.root, `${APPLY.root}/`, APPLY.status]);

@Component({
  selector: 'app-apply-shell',
  imports: [
    LoanSummaryComponent,
    RouterOutlet,
    LanguageMenuComponent,
    BackButtonComponent,
    ReadAloudComponent,
    ThemeToggleComponent,
    BrandLogoComponent,
    DialogComponent,
    ButtonDirective,
    ReactiveFormsModule,
    TPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <!-- Top bar: on a phone the back arrow comes first, and the logo sits under it on the same row as the controls. On wide screens the arrow moves into the card. -->
      <header class="topbar">
        @if (showBack()) {
          <div class="back-row back-phone">
            <app-back-button />
            @if (remainingTime(); as remaining) {
              <span class="time-pill" [class.time-pill--low]="remaining.isLow" role="timer">
                {{ 'result.valid' | t }} <strong>{{ remaining.label }}</strong>
              </span>
            }
          </div>
        }
        <div class="topbar-row">
          <app-brand-logo class="brand-logo" />
          <div class="topbar-right">
            <app-read-aloud />
            <app-theme-toggle />
            <app-language-menu />
          </div>
        </div>
      </header>

      <div class="shell">
        @if (showBack()) {
          <div class="back-row card-top">
            <app-back-button />
            @if (remainingTime(); as remaining) {
              <span class="time-pill" [class.time-pill--low]="remaining.isLow" role="timer">
                {{ 'result.valid' | t }} <strong>{{ remaining.label }}</strong>
              </span>
            }
          </div>
        }

        <main class="body">
          @if (remainingTime()?.isLow) {
            <span class="sr-only" role="status">{{ 'result.valid.low' | t }}</span>
          }
          @if (showSummary()) {
            <app-loan-summary class="summary" />
          }
          <router-outlet />
          @if (canCancel()) {
            <button
              appButton
              type="button"
              variant="secondary"
              class="cancel-action"
              (click)="openCancellation()"
            >
              {{ 'cancel.action' | t }}
            </button>
          }
          <app-dialog
            [open]="cancelOpen()"
            [title]="(cancelled() ? 'status.CANCELLED' : 'cancel.action') | t"
            (closed)="closeCancellation()"
          >
            <ng-template>
              @if (cancelled()) {
                <p>{{ 'cancel.done' | t }}</p>
                @if (needsRevocation()) {
                  <p>{{ 'cancel.revocation' | t }}</p>
                }
                <button appButton type="button" (click)="closeCancellation()">
                  {{ 'common.close' | t }}
                </button>
              } @else {
                <form class="cancel-form" [formGroup]="cancelForm" (ngSubmit)="cancelApplication()">
                  <p>{{ 'cancel.confirm' | t }}</p>
                  <label for="cancel-reason">{{ 'cancel.reason' | t }}</label>
                  <textarea
                    id="cancel-reason"
                    rows="3"
                    maxlength="500"
                    formControlName="reason"
                    [attr.aria-invalid]="
                      (cancelForm.controls.reason.touched && cancelForm.controls.reason.invalid) ||
                      null
                    "
                    [attr.aria-describedby]="
                      cancelForm.controls.reason.touched && cancelForm.controls.reason.invalid
                        ? 'cancel-reason-error'
                        : null
                    "
                  ></textarea>
                  @if (cancelForm.controls.reason.touched && cancelForm.controls.reason.invalid) {
                    <p id="cancel-reason-error" role="alert">{{ 'form.cancelReason' | t }}</p>
                  }
                  @if (store.errors()['cancel']; as error) {
                    <p role="alert">{{ error.message }}</p>
                  }
                  <button appButton type="submit" variant="danger" [disabled]="busy()">
                    {{ 'cancel.action' | t }}
                  </button>
                </form>
              }
            </ng-template>
          </app-dialog>
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        background: var(--canvas);
        color: var(--ink);
      }
      /* Room at the bottom so the floating Support button never sits on top of a step's main button. */
      .page {
        overflow-x: clip;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        padding-bottom: calc(var(--tap-min) + var(--space-8));
        box-sizing: border-box;
      }
      .topbar {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        width: 100%;
        box-sizing: border-box;
        padding: var(--space-2) var(--space-4) 0;
      }
      .topbar-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        min-height: 56px;
      }
      .topbar-right {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .brand-logo {
        height: 30px;
        width: auto;
        display: block;
      }
      .back-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .time-pill {
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-pill);
        background: var(--info-soft);
        color: var(--text-accent);
        font-size: var(--fs-sm);
        font-variant-numeric: tabular-nums;
      }
      .time-pill--low {
        background: var(--warning-soft);
        color: var(--ink);
      }
      .card-top {
        display: none;
      }
      .shell {
        flex: 1;
        width: 100%;
        max-width: 520px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
      }
      .body {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: var(--space-2) var(--space-6) var(--space-6);
      }
      .body > :not(router-outlet):not(.summary) {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
      }
      .cancel-action {
        align-self: center;
        margin-top: var(--space-6);
      }
      .cancel-form {
        display: grid;
        gap: var(--space-3);
      }
      .cancel-form textarea {
        font: inherit;
        color: var(--ink);
        background: var(--canvas);
      }
      .summary {
        margin-bottom: var(--space-3);
      }

      /* Desktop: a page header (logo left, controls right) over a centred card. */
      @media (min-width: 720px) {
        :host {
          background: var(--canvas);
        }
        .page {
          padding-bottom: var(--space-8);
        }
        .topbar {
          max-width: 1040px;
          margin: 0 auto;
          padding: var(--space-5) var(--space-6);
        }
        .back-phone {
          display: none;
        }
        .brand-logo {
          height: 34px;
        }
        .shell {
          flex: 0 0 auto;
          max-width: 480px;
          margin-top: var(--space-2);
        }
        .card-top {
          display: flex;
          padding: var(--space-4) var(--space-6) 0;
        }
        .body {
          padding: var(--space-2) var(--space-6) var(--space-8);
        }
        .foot {
          padding: 0 var(--space-6) var(--space-6);
        }
      }
    `,
  ],
})
export class ApplyShellComponent {
  private readonly router = inject(Router);

  protected readonly store = inject(ApplicationStore);
  private readonly api = inject(ApplicationApi);
  protected readonly cancelOpen = signal(false);
  protected readonly cancelled = signal(false);
  protected readonly needsRevocation = signal(false);
  protected readonly cancelForm = new FormGroup({
    reason: new FormControl('', { nonNullable: true, validators: Validators.maxLength(500) }),
  });
  protected readonly busy = computed(() =>
    Object.entries(this.store.pending()).some(
      ([key, pending]) => pending && !['mandates-poll', 'identity'].includes(key),
    ),
  );
  protected readonly canCancel = computed(
    () =>
      this.store.verified() &&
      this.store.application()?.status === 'DRAFT' &&
      ![APPLY.welcome, APPLY.bvn, APPLY.verify, APPLY.status].some(
        (route) => route === this.currentUrl().split(/[?#]/)[0],
      ),
  );

  protected openCancellation() {
    this.cancelForm.reset();
    this.cancelled.set(false);
    this.needsRevocation.set(false);
    this.store.clearError('cancel');
    this.cancelOpen.set(true);
  }
  protected closeCancellation() {
    this.cancelOpen.set(false);
    this.cancelForm.reset();
  }
  protected async cancelApplication() {
    this.cancelForm.markAllAsTouched();
    if (!this.canCancel() || this.cancelForm.invalid || this.busy()) return;
    const reason = this.cancelForm.controls.reason.value.trim();
    const result = await this.store.run('cancel', () =>
      this.api.cancelApplication(reason ? { reason } : {}),
    );
    if (!result?.cancelled) return;
    this.needsRevocation.set(result.mandatesNeedingRevocation.length > 0);
    this.cancelled.set(true);
    this.cancelForm.reset();
    this.store.reset();
    this.cancelOpen.set(true);
    void this.router.navigateByUrl(APPLY.bvn, { replaceUrl: true });
  }

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly offerResults = inject(OffersStore);
  private readonly eligibilityExpiry = computed(() => {
    const route = this.currentUrl().split(/[?#]/)[0];
    const application = this.store.application();
    if (
      !application ||
      application.status !== 'DRAFT' ||
      !(
        SUMMARY_ROUTES.has(route) ||
        route === APPLY.eligibility ||
        route === APPLY.offers ||
        route === APPLY.terms
      )
    )
      return null;
    const liveResult = this.offerResults.result();
    const result = liveResult ?? application.eligibility;
    if (!result || result.outcome === 'DECLINE') return null;
    const expiry = Date.parse(result.expiresAt);
    return Number.isFinite(expiry) ? expiry : null;
  });
  protected readonly remainingTime = toSignal(
    toObservable(this.eligibilityExpiry).pipe(
      switchMap((expiry) =>
        expiry === null
          ? of(null)
          : timer(0, 1000).pipe(
              map(() => Math.max(0, Math.ceil((expiry - Date.now()) / 1000))),
              takeWhile((seconds) => seconds > 0, true),
              map((seconds) =>
                seconds > 0
                  ? {
                      isLow: seconds < 300,
                      label: Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'),
                    }
                  : null,
              ),
            ),
      ),
    ),
    { initialValue: null },
  );

  readonly showSummary = computed(() => SUMMARY_ROUTES.has(this.currentUrl().split('?')[0]));
  readonly showBack = computed(() => !NO_BACK_ROUTES.has(this.currentUrl().split('?')[0]));
}
