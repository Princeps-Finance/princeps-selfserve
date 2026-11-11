import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';
import { ModalComponent } from '../../shared/modal.component';
import { APPLY } from '../flow/apply-routes';
import { FlowNavigator } from '../flow/flow-navigator.service';
import { EligibilityClock } from './eligibility-clock.service';

/** Opens wherever the customer is when their hour runs out, and takes them back to check again. */
@Component({
  selector: 'app-result-expired-dialog',
  imports: [ModalComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="clock.expired()" [title]="'result.expired.title' | t" (closed)="clock.acknowledge()">
      <div class="body">
        <h2 class="title">{{ 'result.expired.title' | t }}</h2>
        <p class="text">{{ 'result.expired.body' | t }}</p>
        <button type="button" class="cta" (click)="again()"><span>{{ 'result.expired.cta' | t }}</span></button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .body { display: flex; flex-direction: column; gap: var(--space-3); }
      .title { margin: 0; font-family: var(--font-display); font-size: var(--fs-xl); font-weight: 600; }
      .text { margin: 0; color: var(--ink-soft); line-height: 1.5; }
    `,
  ],
})
export class ResultExpiredDialogComponent {
  protected readonly clock = inject(EligibilityClock);
  private readonly flow = inject(FlowNavigator);

  protected again(): void {
    this.clock.acknowledge();
    void this.flow.go(APPLY.salary);
  }
}
