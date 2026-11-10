import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DemoBannerComponent } from './core/demo/demo-banner.component';
import { PrivacyDialogComponent } from './core/privacy/privacy-dialog.component';
import { DraftService } from './core/application/draft.service';
import { PwaBannerComponent } from './core/pwa/pwa-banner.component';
import { ToastHostComponent } from './core/toast/toast-host.component';
import { InstallService } from './core/pwa/install.service';
import { PromoCardComponent } from './shared/promo-card.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHostComponent, PwaBannerComponent, PrivacyDialogComponent, DemoBannerComponent, PromoCardComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // Created at startup so the saved-application effect is running from the first step.
  private readonly drafts = inject(DraftService);

  protected readonly install = inject(InstallService);
}
