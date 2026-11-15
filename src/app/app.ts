import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DemoBannerComponent } from './core/demo/demo-banner.component';
import { PrivacyDialogComponent } from './core/privacy/privacy-dialog.component';
import { DraftService } from './core/application/draft.service';
import { PwaBannerComponent } from './core/pwa/pwa-banner.component';
import { ToastHostComponent } from './core/toast/toast-host.component';
import { HelpLauncherComponent } from './features/apply/help-launcher.component';
import { RouteAnnouncerService } from './core/a11y/route-announcer.service';
import { ThemeService } from './core/theme/theme.service';
import { TPipe } from './core/i18n/t.pipe';
import { InstallService } from './core/pwa/install.service';
import { MultiTabService } from './core/application/multi-tab.service';
import { ToastService } from './core/toast/toast.service';
import { LangService } from './core/i18n/lang.service';
import { HapticsService } from './core/ui/haptics.service';
import { CheckProgressService } from './core/application/check-progress.service';
import { ReferralLinkService } from './core/referral/referral-link.service';
import { ResultExpiredDialogComponent } from './core/eligibility/result-expired-dialog.component';
import { EligibilityClock } from './core/eligibility/eligibility-clock.service';
import { NetworkNoticeComponent } from './core/network/network-notice.component';
import { PullToRefreshComponent } from './core/pwa/pull-to-refresh.component';
import { PromoCardComponent } from './shared/promo-card.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHostComponent, PwaBannerComponent, PrivacyDialogComponent, DemoBannerComponent, PromoCardComponent, HelpLauncherComponent, PullToRefreshComponent, NetworkNoticeComponent, ResultExpiredDialogComponent, TPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // Created at startup so the saved-application effect is running from the first step.
  private readonly drafts = inject(DraftService);

  // Presses on a phone give a short tick, and success and failure give their own.
  private readonly haptics = inject(HapticsService);

  // Created at startup so a reload in the middle of the how-much-can-I-get check keeps its answers.
  private readonly checkProgress = inject(CheckProgressService);

  // Created at startup so a referral code in the link is read before the router drops the query string.
  private readonly referralLink = inject(ReferralLinkService);

  // Created at startup so the saved theme is applied from the first paint.
  private readonly theme = inject(ThemeService);
  // Created at startup so every route change is announced.
  private readonly announcer = inject(RouteAnnouncerService);

  protected readonly install = inject(InstallService);

  // Created at startup so the one-hour result clock runs from the moment a result arrives.
  private readonly eligibilityClock = inject(EligibilityClock);

  // Created at startup so a second open tab is noticed.
  private readonly tabs = inject(MultiTabService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LangService);

  constructor() {
    this.haptics.listen();
    // Private browsing and blocked storage lose progress on close: say so once, early.
    try {
      localStorage.setItem('princeps.probe', '1');
      localStorage.removeItem('princeps.probe');
    } catch {
      this.toast.info(this.lang.t('storage.blocked'), 9000);
    }
  }
}
