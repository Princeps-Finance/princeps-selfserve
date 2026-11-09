import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../core/i18n/t.pipe';
import { ApplicationStateService } from '../../core/application/application-state.service';
import { productById } from '../../core/products/products';

const BACK_MAP: Record<string, string> = {
  '/apply/welcome': '/',
  '/apply/contact': '/apply/welcome',
  '/apply/bvn': '/apply/contact',
  '/apply/verify': '/apply/bvn',
  '/apply/saved': '/apply/contact',
  '/apply/resume': '/apply/contact',
  '/apply/profile': '/apply/bvn',
  '/apply/employment': '/apply/profile',
  '/apply/waitlist': '/apply/employment',
  '/apply/salary': '/apply/employment',
  '/apply/eligibility': '/apply/salary',
  '/apply/offers': '/apply/salary',
  '/apply/terms': '/apply/offers',
  '/apply/nin': '/apply/terms',
  '/apply/statement': '/apply/employment',
  '/apply/verify-identity': '/apply/documents',
  '/apply/mandate': '/apply/verify-identity',
  '/apply/submit': '/apply/mandate',
};

@Component({
  selector: 'app-back-button',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="back" (click)="goBack()" [attr.aria-label]="'apply.back' | t">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M16 10H4M4 10L9 5M4 10L9 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span>{{ 'apply.back' | t }}</span>
    </button>
  `,
  styles: [
    `
      .back {
        display: inline-flex; align-items: center; gap: var(--space-2);
        min-height: 44px; padding: 0 var(--space-4);
        background: transparent; border: 1px solid var(--hairline-strong);
        font-family: var(--font-sans);
        font-size: 14px; font-weight: 500; color: var(--ink);
        cursor: pointer; border-radius: var(--radius-pill);
        transition: background 160ms ease, border-color 160ms ease;
      }
      .back span { white-space: nowrap; }
      /* On narrow phones four top-bar controls do not fit with a text label; keep the arrow (the accessible name stays). */
      @media (max-width: 380px) {
        .back { padding: 0; width: 44px; justify-content: center; }
        .back span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      }
      .back svg { transition: transform 160ms cubic-bezier(0.2, 0.7, 0.1, 1); }
      .back:hover { background: rgba(17,17,17,0.04); border-color: var(--ink); }
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
  private readonly state = inject(ApplicationStateService);

  goBack(): void {
    const here = this.router.url.split('?')[0];
    let target = BACK_MAP[here] ?? '/apply/welcome';
    if (here === '/apply/documents') {
      const needsNin = productById(this.state.offer()?.productId ?? '')?.settings.requiresNin ?? false;
      target = needsNin ? '/apply/nin' : '/apply/terms';
    }
    void this.router.navigateByUrl(target);
  }
}
