import { IconComponent } from '../../../shared/icon.component';
import { AnimatedIconComponent } from '../../../shared/animated-icon.component';
import { HapticsService } from '../../../core/ui/haptics.service';
import { CardComponent } from '../../../shared/card.component';
import { PushService } from '../../../core/pwa/push.service';
import { logWarn } from '../../../core/log';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IllustrationComponent } from '../../../core/ui/illustration.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { environment } from '../../../../environments/environment';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { SUPPORT_EMAIL, SUPPORT_PHONE, whatsappLink } from '../../../core/support';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

/**
 * After a successful submission. The app never claims an outcome (approval, disbursement):
 * it confirms the application reached Caltos and sends the customer to the customer
 * portal, where they can track the loan, repay and get their documents.
 */
@Component({
  selector: 'app-status',
  imports: [IconComponent, AnimatedIconComponent, CardComponent, IllustrationComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './status.component.html',
  styleUrl: './status.component.css',
})
export class StatusComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  protected readonly push = inject(PushService);
  private readonly haptics = inject(HapticsService);

  constructor() {
    // The application went through: a little double tick.
    this.haptics.success();
  }

  readonly submission = this.state.submission;
  /** The business's own support channels. Nothing here is made up: the same ones the Support button offers. */
  readonly whatsapp = whatsappLink('Hello Princeps, I have a question about my application.');
  readonly phone = SUPPORT_PHONE;
  readonly email = SUPPORT_EMAIL;
  /** Your loans live in Princeps Accounts, a separate app. */
  readonly accountsUrl = environment.accountsUrl;
  readonly copied = signal(false);
  readonly copyFailed = signal(false);
  /** Private-sector applicants get a person-led bank statement review, not the scored loan path. */
  readonly isReview = this.state.employment()?.type === 'private-sector';
  readonly telHref = (phone: string): string => `tel:${phone.replace(/\s+/g, '')}`;
  readonly reference = computed(() => this.submission().referenceId ?? '');

  async copyReference(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.reference());
      this.copyFailed.set(false);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    } catch (err) {
      logWarn('status step 1 failed', err);
      // The reference is on screen and can be read out, so say so.
      this.copyFailed.set(true);
    }
  }

  done(): void {
    this.state.reset();
    void this.flow.go(APPLY.home);
  }
}
