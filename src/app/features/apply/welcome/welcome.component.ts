import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IllustrationComponent } from '../../../core/ui/illustration.component';
import { PromoBannerComponent } from '../../../shared/promo-banner.component';
import { TrustFooterComponent } from '../../../shared/trust-footer.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ReturningService } from '../../../core/application/returning.service';
import { ApplicationStateService, ApplyIntent } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

/** First choice: apply now, or just find out how much they could get. Both use the same journey. */
@Component({
  selector: 'app-welcome-intent',
  imports: [PromoBannerComponent, TPipe, IllustrationComponent, TrustFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="step">
      @if (returning.saved(); as r) {
        <app-promo-banner
          [title]="'returning.title' | t: { name: r.firstName }"
          [description]="'returning.sub' | t: { phone: nbsp(r.maskedPhone) }"
          [ctaLabel]="'returning.continue' | t"
          [dismissLabel]="'returning.notyou' | t"
          imageSrc="icons/icon-192.png"
          [imageWidth]="192"
          [imageHeight]="192"
          (action)="continueAs(r.ref)"
          (dismissed)="forgetDevice()"
        />
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
  /** Keeps the masked number on one line. */
  protected nbsp(text: string): string {
    return text.replace(/ /g, '\u00a0');
  }

  /** "Not you?": forget this phone and drop anything this tab still holds, so the next person starts clean. */
  protected forgetDevice(): void {
    this.returning.forget();
    this.state.reset();
  }

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
