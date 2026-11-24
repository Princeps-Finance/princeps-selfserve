import { IconComponent } from '../../shared/components/icon.component';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-back-button',
  imports: [IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="back glass-btn"
      (click)="goBack()"
      [attr.aria-label]="'apply.back' | t"
    >
      <app-icon name="bold-chevron-down" [size]="22" [rotate]="90" />
      <span>{{ 'apply.back' | t }}</span>
    </button>
  `,
  styles: [
    `
      .back {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--ink);
      }
      /* Icon only; the accessible name stays. */
      .back span {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .back app-icon {
        transition: transform 160ms cubic-bezier(0.2, 0.7, 0.1, 1);
      }
      @media (hover: hover) and (pointer: fine) {
        .back:hover app-icon {
          transform: translateX(-2px);
        }
      }
      .back:focus-visible {
        outline: 2px solid transparent;
        outline-offset: 2px;
        box-shadow: var(--focus-ring);
      }
      @media (prefers-reduced-motion: reduce) {
        .back,
        .back app-icon {
          transition: none;
        }
      }
    `,
  ],
})
export class BackButtonComponent {
  private readonly router = inject(Router);
  goBack(): void {
    const path = this.router.url.split(/[?#]/)[0];
    const parityBack: Record<string, string> = {
      '/apply/check/employment': '/apply/welcome',
      '/apply/check/state': '/apply/check/employment',
      '/apply/check/salary': '/apply/check/employment',
      '/apply/check-result': '/apply/check/salary',
      '/apply/resume': '/apply/verify',
      '/apply/saved': '/apply/offers',
      '/apply/loans': '/apply/resume',
      '/apply/waitlist': '/apply/employment',
      '/apply/statement': '/apply/employment',
    };
    if (path.startsWith('/apply/loans/')) {
      void this.router.navigateByUrl('/apply/loans');
      return;
    }
    if (parityBack[path]) {
      void this.router.navigateByUrl(parityBack[path]);
      return;
    }
    const steps = [
      'welcome',
      'bvn',
      'verify',
      'resume',
      'profile',
      'employment',
      'state',
      'salary',
      'eligibility',
      'offers',
      'terms',
      'nin',
      'documents',
      'verify-identity',
      'offer-letter',
      'mandate',
      'submit',
      'status',
    ];
    const current = path.split('/').pop() ?? '';
    if (current === 'profile') {
      void this.router.navigateByUrl('/apply/welcome');
      return;
    }
    const index = steps.indexOf(current);
    void this.router.navigateByUrl('/apply/' + (steps[Math.max(0, index - 1)] ?? 'welcome'));
  }
}
