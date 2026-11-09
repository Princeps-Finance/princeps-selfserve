import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HelpLauncherComponent } from './features/apply/help-launcher.component';
import { PwaBannerComponent } from './core/pwa/pwa-banner.component';
import { ToastHostComponent } from './core/toast/toast-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HelpLauncherComponent, ToastHostComponent, PwaBannerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
