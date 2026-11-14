import { ButtonDirective } from '../../../shared/components/button/button.directive';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { APPLY } from '../../../core/flow/apply-routes';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

/** For customers who only wanted to see what they could get. */
@Component({
  selector: 'app-saved',
  imports: [ButtonDirective, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="step">
      <h1 class="title">{{ 'saved.title' | t }}</h1>
      <p class="body">{{ 'saved.body' | t }}</p>
      <button type="button" class="cta" appButton variant="primary" (click)="apply()">{{ 'saved.apply' | t }}</button>
      <button type="button" class="alt" appButton variant="secondary" (click)="done()">{{ 'status.done' | t }}</button>
    </section>
  `,
  styles: [
    `
.step { gap: var(--space-4); padding-top: var(--space-4); }
.title { font-size: clamp(28px, 7vw, 38px); line-height: 1.1; }
      .body { margin: 0; color: var(--ink-soft); line-height: 1.5; }
      .cta, .alt { min-height: var(--btn-height); border-radius: var(--btn-radius); font: inherit; font-weight: var(--btn-weight); cursor: pointer; }
.cta { border: 0; }
.alt { border: 1px solid var(--ink); background: transparent; }
      .cta:focus-visible, .alt:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--focus-ring); }
    `,
  ],
})
export class SavedComponent {
  private readonly flow = inject(FlowNavigator);
  private readonly state = inject(ApplicationStateService);
  apply(): void {
    // Leaving "just checking": the offers screen must now behave as a real application.
    this.state.setIntent('apply');
    void this.flow.go(APPLY.offers);
  }
  done(): void { void this.flow.go(APPLY.home); }
}
