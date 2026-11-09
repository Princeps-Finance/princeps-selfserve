import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ApplicationStateService, ApplyIntent } from '../../../core/application/application-state.service';

/** First choice: apply now, or just find out how much they could get. Both use the same journey. */
@Component({
  selector: 'app-welcome-intent',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="step">
      <h1 class="title">{{ 'welcome.intent.title' | t }}</h1>
      <div class="options">
        <button type="button" class="option option--primary" (click)="choose('apply')">
          <span class="option-title">{{ 'welcome.intent.apply' | t }}</span>
          <span class="option-hint">{{ 'welcome.intent.apply.hint' | t }}</span>
        </button>
        <button type="button" class="option" (click)="choose('check')">
          <span class="option-title">{{ 'welcome.intent.check' | t }}</span>
          <span class="option-hint">{{ 'welcome.intent.check.hint' | t }}</span>
        </button>
      </div>
    </section>
  `,
  styles: [
    `
      .step { display: flex; flex-direction: column; gap: var(--space-6); padding-top: var(--space-4); }
      .title { margin: 0; font-size: clamp(30px, 7vw, 40px); line-height: 1.1; }
      .options { display: flex; flex-direction: column; gap: var(--space-4); }
      .option {
        display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1);
        min-height: 96px; padding: var(--space-5); text-align: left; cursor: pointer; font: inherit;
        border: 1px solid var(--input-border); border-radius: var(--radius-lg);
        background: var(--surface-0); color: var(--ink);
        transition: transform 120ms ease-out, border-color 140ms ease;
      }
      .option:hover { border-color: var(--ink); }
      .option:active { transform: scale(0.99); }
      .option--primary { background: var(--action-primary); border-color: var(--action-primary); color: var(--action-on-primary); }
      .option-title { font-family: var(--font-display); font-size: 22px; font-weight: 600; }
      .option-hint { font-size: 14px; line-height: 1.4; opacity: 0.85; }
      .option:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--focus-ring); }
      @media (prefers-reduced-motion: reduce) { .option { transition: none; } }
    `,
  ],
})
export class WelcomeIntentComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly router = inject(Router);

  choose(intent: ApplyIntent): void {
    this.state.setIntent(intent);
    void this.router.navigateByUrl('/apply/bvn');
  }
}
