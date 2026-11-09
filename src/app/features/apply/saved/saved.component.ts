import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../../core/i18n/t.pipe';

/** For customers who only wanted to see what they could get. */
@Component({
  selector: 'app-saved',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="step">
      <h1 class="title">{{ 'saved.title' | t }}</h1>
      <p class="body">{{ 'saved.body' | t }}</p>
      <button type="button" class="cta" (click)="apply()">{{ 'saved.apply' | t }}</button>
      <button type="button" class="alt" (click)="done()">{{ 'status.done' | t }}</button>
    </section>
  `,
  styles: [
    `
      .step { display: flex; flex-direction: column; gap: var(--space-4); padding-top: var(--space-4); }
      .title { margin: 0; font-size: clamp(28px, 7vw, 38px); line-height: 1.1; }
      .body { margin: 0; color: var(--ink-soft); line-height: 1.5; }
      .cta, .alt { min-height: 56px; border-radius: var(--radius-pill); font: inherit; font-weight: 500; cursor: pointer; }
      .cta { border: 0; background: var(--action-primary); color: var(--action-on-primary); }
      .alt { border: 1px solid var(--ink); background: transparent; color: var(--ink); }
      .cta:focus-visible, .alt:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--focus-ring); }
    `,
  ],
})
export class SavedComponent {
  private readonly router = inject(Router);
  apply(): void { void this.router.navigateByUrl('/apply/offers'); }
  done(): void { void this.router.navigateByUrl('/'); }
}
