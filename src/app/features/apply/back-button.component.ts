import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../core/i18n/t.pipe';

const BACK_MAP: Record<string, string> = {
  '/apply/verify': '/apply/contact',
  '/apply/employment': '/apply/verify',
  '/apply/waitlist': '/apply/employment',
  '/apply/salary': '/apply/employment',
  '/apply/offers': '/apply/salary',
  '/apply/terms': '/apply/offers',
  '/apply/profile': '/apply/terms',
  '/apply/bvn': '/apply/profile',
  '/apply/documents': '/apply/bvn',
  '/apply/submit': '/apply/documents',
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

  goBack(): void {
    const here = this.router.url.split('?')[0];
    const target = BACK_MAP[here] ?? '/apply/contact';
    void this.router.navigateByUrl(target);
  }
}
