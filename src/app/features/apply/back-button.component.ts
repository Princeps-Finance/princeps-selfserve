import { IconComponent } from '../../shared/icon.component';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../core/i18n/t.pipe';
import { ApplicationStateService } from '../../core/application/application-state.service';
import { JourneyService } from '../../core/flow/journey';
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
  [APPLY.checkResult]: APPLY.salary,
};

/** In the no-identity check the steps lead back through the work questions, not through the profile. */
const CHECK_BACK: Record<string, string> = {
  [APPLY.employment]: APPLY.welcome,
  [APPLY.salary]: APPLY.employment,
  [APPLY.eligibility]: APPLY.salary,
  [APPLY.statement]: APPLY.employment,
};

@Component({
  selector: 'app-back-button',
  imports: [IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="back glass-btn" (click)="goBack()" [attr.aria-label]="'apply.back' | t">
      <app-icon name="bold-chevron-down" [size]="22" [rotate]="90" />
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
      .back app-icon { transition: transform 160ms cubic-bezier(0.2, 0.7, 0.1, 1); }
      @media (hover: hover) and (pointer: fine) { .back:hover app-icon { transform: translateX(-2px); } }
      .back:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--focus-ring); }
      @media (prefers-reduced-motion: reduce) {
        .back, .back app-icon { transition: none; }
      }
    `,
  ],
})
export class BackButtonComponent {
  private readonly router = inject(Router);
  private readonly flow = inject(FlowNavigator);
  private readonly state = inject(ApplicationStateService);
  private readonly journey = inject(JourneyService);

  goBack(): void {
    const here = this.router.url.split('?')[0];
    const checking = this.state.intent() === 'check';
    let target = (checking ? CHECK_BACK[here] : undefined) ?? BACK_MAP[here] ?? (here.startsWith(`${APPLY.loans}/`) ? APPLY.loans : APPLY.welcome);
    if (here === APPLY.checkResult && this.state.employment()?.type === 'private-sector') target = APPLY.statement;
    // The steps after the offer go back along this product's own order.
    const before = this.journey.previous(here);
    if (before) target = before;
    void this.flow.go(target);
  }
}
