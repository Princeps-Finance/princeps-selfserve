import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ModalComponent } from '../../shared/modal.component';
import { TPipe } from '../i18n/t.pipe';
import { APPLY } from '../flow/apply-routes';
import { FlowNavigator } from '../flow/flow-navigator.service';
import { NetworkActivityService } from './network-activity.service';

/**
 * Two things the customer should hear about but that belong to no one screen: a slow connection, and a phone clock that
 * is wrong. A third, a session the server dropped, gets a window that takes them back to sign in again.
 */
@Component({
  selector: 'app-network-notice',
  imports: [ModalComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (net.slow()) {
      <p class="note" role="status">{{ 'net.slow' | t }}</p>
    } @else if (net.clockWrong()) {
      <p class="note note--warn" role="status">{{ 'net.clock' | t }}</p>
    }

    <app-modal [open]="net.sessionExpired()" [title]="'net.session.title' | t" (closed)="net.acknowledgeSession()">
      <div class="body">
        <h2 class="title">{{ 'net.session.title' | t }}</h2>
        <p class="text">{{ 'net.session.body' | t }}</p>
        <button type="button" class="cta" (click)="signInAgain()"><span>{{ 'net.session.cta' | t }}</span></button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .note {
        position: fixed; left: 50%; transform: translateX(-50%); z-index: 90; margin: 0;
        top: calc(env(safe-area-inset-top) + var(--space-2)); max-width: min(92vw, 420px);
        padding: var(--space-2) var(--space-4); border-radius: var(--radius-pill);
        background: var(--ink); color: var(--canvas); font-size: var(--fs-sm); text-align: center; box-shadow: var(--shadow-3);
      }
      .note--warn { background: var(--warning-soft); color: var(--ink); border: 1px solid var(--hairline-strong); }
      .body { display: flex; flex-direction: column; gap: var(--space-3); }
      .title { margin: 0; font-family: var(--font-display); font-size: var(--fs-xl); font-weight: 600; }
      .text { margin: 0; color: var(--ink-soft); line-height: 1.5; }
    `,
  ],
})
export class NetworkNoticeComponent {
  protected readonly net = inject(NetworkActivityService);
  private readonly flow = inject(FlowNavigator);

  protected signInAgain(): void {
    this.net.acknowledgeSession();
    void this.flow.go(APPLY.welcome);
  }
}
