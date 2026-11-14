import { ButtonDirective } from '../../shared/components/button/button.directive';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../core/i18n/t.pipe';
import { ApplicationStateService } from '../../core/application/application-state.service';
import { productById } from '../../core/products/products';
import { APPLY } from '../../core/flow/apply-routes';
import { FlowNavigator } from '../../core/flow/flow-navigator.service';

const BACK_MAP: Record<string, string> = {
  [APPLY.welcome]: APPLY.home,
  [APPLY.bvn]: APPLY.welcome,
  [APPLY.verify]: APPLY.bvn,
  [APPLY.saved]: APPLY.welcome,
  [APPLY.resume]: APPLY.welcome,
  [APPLY.profile]: APPLY.welcome,
  [APPLY.employment]: APPLY.profile,
  [APPLY.waitlist]: APPLY.employment,
  [APPLY.salary]: APPLY.employment,
  [APPLY.eligibility]: APPLY.salary,
  [APPLY.offers]: APPLY.salary,
  [APPLY.terms]: APPLY.offers,
  [APPLY.nin]: APPLY.terms,
  [APPLY.statement]: APPLY.employment,
  [APPLY.verifyIdentity]: APPLY.documents,
  [APPLY.mandate]: APPLY.verifyIdentity,
  [APPLY.submit]: APPLY.mandate,
};

@Component({
  selector: 'app-back-button',
  imports: [ButtonDirective, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="back" appButton variant="glass" (click)="goBack()" [attr.aria-label]="'apply.back' | t">
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M12.5 4.5L7 10L12.5 15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span>{{ 'apply.back' | t }}</span>
    </button>
  `,
  styles: [
    `
      .back {
        display: inline-flex; align-items: center; justify-content: center;
        color: var(--ink);
      }
      /* Icon only; the accessible name stays. */
      .back span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .back svg { transition: transform 160ms cubic-bezier(0.2, 0.7, 0.1, 1); }
      .back:hover svg { transform: translateX(-2px); }
      .back:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--focus-ring); }
      @media (prefers-reduced-motion: reduce) {
        .back, .back svg { transition: none; }
      }
    `,
  ],
})
export class BackButtonComponent {
  private readonly router = inject(Router);
  private readonly flow = inject(FlowNavigator);
  private readonly state = inject(ApplicationStateService);

  goBack(): void {
    const here = this.router.url.split('?')[0];
    let target = BACK_MAP[here] ?? (here.startsWith(`${APPLY.loans}/`) ? APPLY.loans : APPLY.welcome);
    if (here === APPLY.documents) {
      const needsNin = productById(this.state.offer()?.productId ?? '')?.settings.requiresNin ?? false;
      target = needsNin ? APPLY.nin : APPLY.terms;
    }
    void this.flow.go(target);
  }
}
