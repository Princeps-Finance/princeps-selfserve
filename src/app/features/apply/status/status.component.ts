import { PushService } from '../../../core/pwa/push.service';
import { logWarn } from '../../../core/log';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IllustrationComponent } from '../../../core/ui/illustration.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { AGENTS, OFFICES } from '../../../core/directory/contacts';
import { environment } from '../../../../environments/environment';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

/**
 * After a successful submission. The app never claims an outcome (approval, disbursement):
 * it confirms the application reached Caltos and sends the customer to the customer
 * portal, where they can track the loan, repay and get their documents.
 */
@Component({
  selector: 'app-status',
  imports: [IllustrationComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './status.component.html',
  styleUrl: './status.component.css',
})
export class StatusComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  protected readonly push = inject(PushService);

  readonly submission = this.state.submission;
  readonly agents = AGENTS;
  readonly offices = OFFICES;
  readonly trackUrl = environment.customerModuleUrl;
  readonly copied = signal(false);
  /** Private-sector applicants get a person-led bank statement review, not the scored loan path. */
  readonly isReview = this.state.employment()?.type === 'private-sector';
  readonly telHref = (phone: string): string => `tel:${phone.replace(/\s+/g, '')}`;
  readonly reference = computed(() => this.submission().referenceId ?? '');

  async copyReference(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.reference());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    } catch (err) {
        logWarn('status step 1 failed', err);
// The reference is on screen and can be read out.
    }
  }

  done(): void {
    this.state.reset();
    void this.flow.go(APPLY.home);
  }
}
