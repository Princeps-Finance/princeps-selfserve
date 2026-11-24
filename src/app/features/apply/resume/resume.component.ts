import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective } from '@princeps-finance/ui';
import { AnimatedIconComponent } from '../../../shared/components/animated-icon.component';
import { IllustrationComponent } from '../../../shared/components/illustration.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ApplicationStore } from '../state/application.store';

@Component({
  selector: 'app-resume-application',
  imports: [ButtonDirective, AnimatedIconComponent, IllustrationComponent, TPipe],
  template: `
    <section class="step">
      <app-illustration name="document" [size]="120" />
      <header class="head">
        <h1 class="title">{{ 'resume.title' | t }}</h1>
        <p class="subtitle">{{ 'resume.body' | t }}</p>
      </header>
      @if (application(); as application) {
        <div class="card">
          <p class="label">{{ 'resume.stopped' | t }}</p>
          <p class="where">{{ stepLabel() | t }}</p>
          <div class="bar" aria-hidden="true">
            @for (segment of segments; track segment) {
              <span [class.on]="segment <= stage()"></span>
            }
          </div>
          <p class="meta">{{ 'resume.saved' | t: { when: savedAt() } }}</p>
        </div>
        <div class="actions">
          <button appButton class="cta" type="button" (click)="continueApplication()">
            {{ 'resume.continue' | t }}
            <app-animated-icon animation="arrow-right" fallback="outline-arrow-right" [size]="18" />
          </button>
          @if (application.returningCustomer) {
            <button appButton variant="secondary" type="button" (click)="viewLoans()">
              {{ 'loans.title' | t }}
            </button>
          }
          <button class="link" type="button" (click)="editProfile()">
            {{ 'resume.start_over' | t }}
          </button>
        </div>
      }
    </section>
  `,
  styleUrl: '../apply-step.css',
  styles: [
    `
      .head {
        text-align: center;
        display: grid;
        gap: var(--space-2);
      }
      .label,
      .where,
      .meta {
        margin: 0;
      }
      .label,
      .meta {
        color: var(--ink-soft);
        font-size: var(--fs-sm);
      }
      .where {
        font-size: var(--fs-xl);
        font-weight: 600;
      }
      .bar {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-1);
      }
      .bar span {
        height: 4px;
        border-radius: 999px;
        background: var(--hairline-strong);
      }
      .bar span.on {
        background: var(--action-primary);
      }
      .actions {
        margin-top: auto;
        display: grid;
        gap: var(--space-3);
        padding-top: var(--space-5);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumeComponent {
  readonly store = inject(ApplicationStore);
  private readonly router = inject(Router);
  readonly application = this.store.application;
  readonly segments = [1, 2, 3, 4];
  readonly stage = computed(() => {
    const route = this.application()?.suggestedNext ?? 'profile';
    if (['profile', 'employment', 'salary'].includes(route)) return 2;
    if (['eligibility', 'offer', 'offers', 'terms'].includes(route)) return 3;
    return 4;
  });
  readonly stepLabel = computed(() => {
    const route = this.application()?.suggestedNext ?? 'profile';
    if (['profile', 'employment', 'salary'].includes(route)) return `resume.step.${route}`;
    return 'resume.step.eligibility';
  });
  readonly savedAt = computed(() => {
    const value = this.application()?.updatedAt;
    return value
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(value),
        )
      : '';
  });

  constructor() {
    if (!this.application()) void this.router.navigateByUrl('/apply/bvn', { replaceUrl: true });
  }

  continueApplication() {
    void this.router.navigateByUrl(this.store.nextRoute());
  }

  viewLoans() {
    void this.router.navigateByUrl('/apply/loans');
  }

  editProfile() {
    void this.router.navigateByUrl('/apply/profile');
  }
}
