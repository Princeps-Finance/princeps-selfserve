import { logWarn } from '../../../core/log';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { formatNaira } from '../../../core/money.util';
import { API_CLIENT, MandateStatus } from '../../../core/api/api-client';
import { productById } from '../../../core/products/products';
import { LangService } from '../../../core/i18n/lang.service';
import { telLink, whatsappLink } from '../../../core/support';
import { IllustrationComponent } from '../../../core/ui/illustration.component';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

@Component({
  selector: 'app-mandate',
  imports: [TPipe, WizardProgressComponent, IllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mandate.component.html',
  styleUrl: './mandate.component.css',
})
export class MandateComponent {
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);
  private readonly api = inject(API_CLIENT);
  private readonly lang = inject(LangService);
  private readonly destroyRef = inject(DestroyRef);

  readonly offer = this.state.offer;
  readonly salary = this.state.salary;
  /** Link-mode mandates are two screens: review the deduction, then complete the mandate. */
  readonly view = signal<'review' | 'link'>('review');
  readonly agreed = signal(false);
  readonly attempted = signal(false);
  readonly formatNaira = formatNaira;

  readonly employment = this.state.employment;

  readonly channelKey = computed(() => {
    const c = this.salary()?.channel;
    if (c === 'ippis') return 'step.mandate.channel.ippis';
    if (c === 'remita') return 'step.mandate.channel.remita';
    return 'step.mandate.channel.dedukt';
  });

  readonly channelDescKey = computed(() => {
    const c = this.salary()?.channel;
    if (c === 'ippis') return 'step.mandate.channel.ippis.desc';
    if (c === 'remita') return 'step.mandate.channel.remita.desc';
    return 'step.mandate.channel.dedukt.desc';
  });

  readonly isCorperMonoCharge = computed(() =>
    this.employment()?.type === 'corper' && this.salary()?.channel === 'dedukt',
  );

  readonly monthlyRepayment = computed(() => this.offer()?.monthlyRepayment ?? 0);
  readonly tenorMonths = computed(() => this.offer()?.tenorMonths ?? 0);

  /** 'authorize' = tick-box; 'link' = the customer completes a link (set per product in Caltos). */
  readonly mode = computed(() => productById(this.offer()?.productId ?? '')?.settings.mandate ?? 'authorize');

  // ---- link mode ----
  readonly linkUrl = signal<string | null>(null);
  readonly linkRef = signal<string | null>(null);
  readonly linkStatus = signal<MandateStatus | null>(null);
  readonly linkError = signal(false);
  readonly linkBusy = signal(false);
  readonly copied = signal(false);
  readonly help = whatsappLink('Hello Princeps, I need help setting up my repayment mandate.');
  readonly tel = telLink();
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPolling());
    const existing = this.state.mandate();
    if (existing?.mode === 'link' && existing.reference && !existing.authorized) {
      // Came back to a link that was already created: show its current state, don't make a second one.
      this.linkRef.set(existing.reference);
      this.linkUrl.set(null);
    }
    // Only create a link when none exists yet; a second one would orphan the first.
    if (this.mode() === 'link' && !existing?.reference) void this.prepareLink();
  }

  showLink(): void {
    this.view.set('link');
    window.scrollTo({ top: 0 });
  }

  async prepareLink(): Promise<void> {
    const o = this.offer();
    const s = this.salary();
    if (!o || !s || this.linkBusy()) return;
    this.linkBusy.set(true);
    this.linkError.set(false);
    try {
      const link = await this.api.createMandateLink({
        productId: o.productId,
        channel: s.channel,
        monthlyAmount: o.monthlyRepayment,
        tenorMonths: o.tenorMonths,
      });
      this.linkUrl.set(link.url);
      this.linkRef.set(link.reference);
      this.linkStatus.set('pending');
      this.startPolling();
    } catch (err) {
        logWarn('mandate step 1 failed', err);
this.linkError.set(true);
    } finally {
      this.linkBusy.set(false);
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.poll = setInterval(() => {
      if (document.visibilityState === 'visible') void this.checkNow();
    }, 5000);
  }

  private stopPolling(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  async checkNow(): Promise<void> {
    const ref = this.linkRef();
    if (!ref || this.linkStatus() === 'completed') return;
    try {
      const status = await this.api.getMandateStatus(ref);
      this.linkStatus.set(status);
      if (status === 'completed') this.stopPolling();
    } catch (err) {
        logWarn('mandate step 2 failed', err);
// Keep the last known state; the next check will try again.
    }
  }

  async copyLink(): Promise<void> {
    const url = this.linkUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    } catch (err) {
        logWarn('mandate step 3 failed', err);
// Clipboard blocked: the link is still visible and can be opened.
    }
  }

  continueWithLink(): void {
    const o = this.offer();
    const s = this.salary();
    if (!o || !s || this.linkStatus() !== 'completed') return;
    this.state.setMandate({
      authorized: true,
      channel: s.channel,
      monthlyAmount: o.monthlyRepayment,
      tenorMonths: o.tenorMonths,
      authorizedAt: new Date().toISOString(),
      mode: 'link',
      reference: this.linkRef() ?? undefined,
    });
    void this.flow.go(APPLY.submit);
  }

  toggleAgree(v: boolean): void {
    this.agreed.set(v);
    if (v) this.attempted.set(false);
  }

  authorize(): void {
    if (!this.agreed()) {
      this.attempted.set(true);
      document.querySelector<HTMLElement>('.agree input')?.focus();
      return;
    }
    const o = this.offer();
    const s = this.salary();
    if (!o || !s) return;
    this.state.setMandate({
      authorized: true,
      channel: s.channel,
      monthlyAmount: o.monthlyRepayment,
      tenorMonths: o.tenorMonths,
      authorizedAt: new Date().toISOString(),
      mode: 'authorize',
    });
    void this.flow.go(APPLY.submit);
  }
}
