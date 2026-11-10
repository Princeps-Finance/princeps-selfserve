import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IllustrationComponent } from '../../../core/ui/illustration.component';
import { TrustFooterComponent } from '../../../shared/trust-footer.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ReturningService } from '../../../core/application/returning.service';
import { ApplicationStateService, ApplyIntent } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

/** First choice: apply now, or just find out how much they could get. Both use the same journey. */
@Component({
  selector: 'app-welcome-intent',
  imports: [TPipe, IllustrationComponent, TrustFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="step">
      @if (returning.saved(); as r) {
        <div class="returning" role="region" [attr.aria-label]="'returning.title' | t: { name: r.firstName }">
          <p class="returning-title">{{ 'returning.title' | t: { name: r.firstName } }}</p>
          <p class="returning-sub">{{ 'returning.sub' | t: { phone: r.maskedPhone } }}</p>
          <button type="button" class="cta" (click)="continueAs(r.ref)">{{ 'returning.continue' | t }}</button>
          <button type="button" class="returning-forget" (click)="returning.forget()">{{ 'returning.notyou' | t }}</button>
        </div>
      }
      <app-illustration name="coins" [size]="176" />
      <h1 class="title">{{ 'welcome.intent.title' | t }}</h1>

      <div class="actions">
        <div class="choice">
          <button type="button" class="cta" (click)="choose('apply')">
            <span>{{ 'welcome.intent.apply' | t }}</span>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <p class="hint">{{ 'welcome.intent.apply.hint' | t }}</p>
        </div>
        <div class="choice">
          <button type="button" class="alt" (click)="choose('check')">{{ 'welcome.intent.check' | t }}</button>
          <p class="hint">{{ 'welcome.intent.check.hint' | t }}</p>
        </div>
      </div>

      <app-trust-footer />
    </section>
  `,
  styles: [
    `
.step { gap: var(--space-5); padding-top: var(--space-6); }
.title { text-align: center; font-size: clamp(24px, 6.5vw, 30px); line-height: 1.15; letter-spacing: -0.02em; }
      .actions { margin-top: auto; display: flex; flex-direction: column; gap: var(--space-5); padding-top: var(--space-6); }
      .choice { display: flex; flex-direction: column; gap: var(--space-2); }
      .hint { margin: 0; text-align: center; font-size: var(--fs-md); color: var(--ink-soft); }
      .returning { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--grey-100); }
      .returning-title { margin: 0; font-family: var(--font-display); font-size: var(--fs-lg); font-weight: 600; }
      .returning-sub { margin: 0 0 var(--space-2); color: var(--ink-soft); font-size: var(--fs-md); }
      .returning-forget { align-self: center; min-height: var(--tap-min); border: 0; background: none; color: var(--ink-soft); font: inherit; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
      .cta, .alt {
        min-height: var(--btn-height); padding: 0 var(--space-6); border-radius: var(--btn-radius); cursor: pointer;
        font-family: var(--font-sans); font-size: var(--fs-base); font-weight: var(--btn-weight);
        display: inline-flex; align-items: center; justify-content: center; gap: var(--space-3);
        transition: background 160ms ease, transform 120ms ease-out;
      }
.cta { border: 0; margin-top: 0 !important; }
      .cta:hover { background: var(--action-primary-hover); }

.alt:hover { background: var(--hover-tint); }
      .cta:active, .alt:active { transform: scale(0.99); }
      .cta:focus-visible, .alt:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--focus-ring); }
      @media (prefers-reduced-motion: reduce) { .cta, .alt { transition: none; } }
    `,
  ],
})
export class WelcomeIntentComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  protected readonly returning = inject(ReturningService);

  /** One tap back in: the code goes to the BVN-linked phone, and no BVN is typed. */
  protected continueAs(ref: string): void {
    this.state.setIntent('apply');
    this.state.setReturningRef(ref);
    void this.flow.go(APPLY.verify);
  }

  choose(intent: ApplyIntent): void {
    this.state.setIntent(intent);
    // Checking how much you can get needs no identity: it starts with the work questions.
    void this.flow.go(intent === 'check' ? APPLY.employment : APPLY.bvn);
  }
}
