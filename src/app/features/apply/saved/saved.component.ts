import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective } from '@princeps-finance/ui';
import { TPipe } from '../../../core/i18n/t.pipe';

@Component({
  selector: 'app-saved-application',
  imports: [ButtonDirective, TPipe],
  template: `
    <section class="step">
      <h1 class="title">{{ 'saved.title' | t }}</h1>
      <p class="subtitle">{{ 'saved.body' | t }}</p>
      <div class="actions">
        <button appButton type="button" (click)="continueApplication()">
          {{ 'saved.apply' | t }}
        </button>
        <button appButton variant="secondary" type="button" (click)="done()">
          {{ 'status.done' | t }}
        </button>
      </div>
    </section>
  `,
  styleUrl: '../apply-step.css',
  styles: [
    `
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
export class SavedComponent {
  private readonly router = inject(Router);
  continueApplication() {
    void this.router.navigateByUrl('/apply/offers');
  }
  done() {
    void this.router.navigateByUrl('/apply/welcome');
  }
}
