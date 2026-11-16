import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PrivacyDialogComponent } from './features/privacy/privacy-dialog.component';
import { PrivacyService } from './features/privacy/privacy.service';
import { PwaBannerComponent } from './features/install/pwa-banner.component';
import { ToastHostComponent } from './shared/components/toast/toast-host.component';
import { HelpLauncherComponent } from './features/support/help-launcher.component';
import { RouteAnnouncerService } from './route-announcer.service';
import { ThemeService } from './core/preferences/theme.service';
import { TPipe } from './core/i18n/t.pipe';
import { InstallService } from './core/pwa/install.service';
import { HapticsService } from './shared/haptics.service';
import { PromoCardComponent } from './features/install/promo-card.component';
import {
  ApplicationSession,
  clearLegacyCustomerStorage,
} from './core/session/application-session.service';
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ToastHostComponent,
    PwaBannerComponent,
    PrivacyDialogComponent,
    PromoCardComponent,
    HelpLauncherComponent,
    TPipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly haptics = inject(HapticsService);
  private readonly theme = inject(ThemeService);
  private readonly announcer = inject(RouteAnnouncerService);
  protected readonly privacy = inject(PrivacyService);
  protected readonly install = inject(InstallService);
  private readonly session = inject(ApplicationSession);
  private readonly router = inject(Router);
  constructor() {
    clearLegacyCustomerStorage();
    this.haptics.listen();
    const reset = () => this.session.reset();
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) {
        reset();
        void this.router.navigateByUrl('/apply/bvn');
      }
    };
    window.addEventListener('pagehide', reset);
    window.addEventListener('pageshow', restore);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('pagehide', reset);
      window.removeEventListener('pageshow', restore);
    });
    effect(() => {
      if (
        this.session.generation() > 0 &&
        !this.session.applicationId() &&
        !['/', '/apply', '/apply/welcome', '/apply/bvn'].includes(this.router.url.split(/[?#]/)[0])
      )
        void this.router.navigateByUrl('/apply/bvn');
    });
  }
}
