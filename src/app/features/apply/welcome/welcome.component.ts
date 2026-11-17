import { RouterLink } from '@angular/router';
import { ButtonDirective } from '@princeps-finance/ui';
import { AnimatedIconComponent } from '../../../shared/components/animated-icon.component';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IllustrationComponent } from '../../../shared/components/illustration.component';
import { TrustFooterComponent } from '../../privacy/trust-footer.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { APPLY } from '../apply-routes';

@Component({
  selector: 'app-welcome-intent',
  imports: [
    AnimatedIconComponent,
    ButtonDirective,
    RouterLink,
    TPipe,
    IllustrationComponent,
    TrustFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="step">
      <app-illustration name="coins" [size]="176" />
      <div class="intro">
        <h1 class="title">{{ 'welcome.intent.title' | t }}</h1>
        <p class="subtitle">{{ 'welcome.intent.subtitle' | t }}</p>
      </div>

      <div class="actions">
        <div class="choice">
          <a appButton class="cta" [routerLink]="applyPath">
            <span>{{ 'welcome.intent.apply' | t }}</span>
            <app-animated-icon animation="arrow-right" fallback="outline-arrow-right" [size]="18" />
          </a>
          <p class="hint">{{ 'welcome.intent.apply.hint' | t }}</p>
        </div>
      </div>

      @if (accountsUrl) {
        <div class="signin">
          <a class="link" [attr.href]="accountsUrl">{{ 'welcome.signin' | t }}</a>
        </div>
      }

      <app-trust-footer />
    </section>
  `,
  styles: [
    `
      .step {
        gap: var(--space-5);
        padding-top: var(--space-6);
        padding-bottom: var(--space-12, 56px);
      } /* clears the floating Support button */
      .intro {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .subtitle {
        margin: 0;
        text-align: center;
        color: var(--ink-soft);
        line-height: 1.5;
      }
      .title {
        text-align: center;
        font-size: clamp(24px, 6.5vw, 30px);
        line-height: 1.15;
        letter-spacing: -0.02em;
      }
      .actions {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        padding-top: var(--space-6);
      }
      .signin {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-1);
      }
      .link {
        display: inline-flex;
        align-items: center;
        min-height: var(--tap-min);
        padding: 0 var(--space-3);
        font: inherit;
        font-weight: var(--fw-medium);
        color: var(--text-accent);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .link:focus-visible {
        outline: 2px solid transparent;
        box-shadow: var(--focus-ring);
        border-radius: var(--radius-sm);
      }
      .choice {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .hint {
        margin: 0;
        text-align: center;
        font-size: var(--fs-md);
        color: var(--ink-soft);
      }
      .cta {
        min-height: var(--btn-height);
        padding: 0 var(--space-6);
        border-radius: var(--btn-radius);
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: var(--fs-base);
        font-weight: var(--btn-weight);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-3);
        transition:
          background 160ms ease,
          transform 120ms ease-out;
      }
      .cta {
        position: relative;
        border: 0;
        margin-top: 0 !important;
      }
      .cta app-animated-icon {
        position: absolute;
        inset-inline-end: var(--space-5);
      }
      @media (hover: hover) and (pointer: fine) {
        .cta:hover {
          background: var(--action-primary-hover);
        }
      }

      .cta:active {
        transform: scale(0.99);
      }
      .cta:focus-visible {
        outline: 2px solid transparent;
        outline-offset: 2px;
        box-shadow: var(--focus-ring);
      }
      @media (prefers-reduced-motion: reduce) {
        .cta {
          transition: none;
        }
      }
    `,
  ],
})
export class WelcomeIntentComponent {
  protected readonly applyPath = APPLY.bvn;
  protected readonly accountsUrl = import.meta.env?.NG_APP_ACCOUNTS_URL?.trim();
}
