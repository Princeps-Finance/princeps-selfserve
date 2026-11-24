import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from '@princeps-finance/ui';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ApiError, apiError } from '../data-access/api-error';
import { WaitlistRequest, WaitlistResponse } from '../data-access/parity-contract';
import { ParityApi } from '../data-access/parity.api';

@Component({
  selector: 'app-waitlist',
  imports: [ButtonDirective, SpinnerComponent, TPipe],
  template: `
    <section class="step">
      <header class="head">
        <h1 class="title">{{ 'waitlist.title' | t }}</h1>
        <p class="subtitle">{{ 'waitlist.body' | t }}</p>
      </header>
      @if (!result()) {
        <div class="form">
          @if (error(); as error) {
            <p class="error" role="alert">{{ error.message }}</p>
          }
          <button appButton class="cta" type="button" [disabled]="pending()" (click)="join()">
            @if (pending()) {
              <app-spinner [inline]="true" [label]="'common.loading' | t" />
            }
            {{ (pending() ? 'waitlist.joining' : 'waitlist.join') | t }}
          </button>
        </div>
      } @else if (result(); as result) {
        <div class="summary" role="status">
          <h2>{{ 'waitlist.joined' | t }}</h2>
          <p>{{ 'waitlist.result.registered' | t: { date: date(result.registeredAt) } }}</p>
          <p>{{ 'waitlist.result.note' | t }}</p>
        </div>
        <button appButton variant="secondary" type="button" (click)="home()">
          {{ 'waitlist.back' | t }}
        </button>
      }
    </section>
  `,
  styleUrl: '../apply-step.css',
  styles: [
    `
      .head {
        display: grid;
        gap: var(--space-2);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitlistComponent {
  private readonly api = inject(ParityApi);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly requestedType = inject(ActivatedRoute).snapshot.queryParamMap.get('type');
  readonly employmentType: WaitlistRequest['employmentType'] =
    this.requestedType === 'own-business' ? 'own-business' : 'private-sector';
  readonly result = signal<WaitlistResponse | null>(null);
  readonly pending = signal(false);
  readonly error = signal<ApiError | null>(null);
  async join() {
    if (this.pending()) return;
    this.pending.set(true);
    this.error.set(null);
    try {
      const result = await this.api.joinWaitlist({
        employmentType: this.employmentType,
      });
      if (!this.destroy.destroyed) this.result.set(result);
    } catch (error) {
      if (!this.destroy.destroyed) this.error.set(apiError(error));
    } finally {
      if (!this.destroy.destroyed) this.pending.set(false);
    }
  }
  home() {
    void this.router.navigateByUrl('/apply/welcome');
  }
  date(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  }
}
