import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';
import { environment } from '../../../environments/environment';

/** A thin, always-visible strip while the app runs on the mock, so nobody mistakes it for the real service. */
@Component({
  selector: 'app-demo-banner',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show) {
      <p class="demo" role="note">{{ 'demo.banner' | t }}</p>
    }
  `,
  styles: [
    `
      .demo {
        margin: 0; padding: 6px var(--space-4); text-align: center;
        background: var(--navy-950); color: #fff; font-size: 12px; line-height: 1.4;
      }
    `,
  ],
})
export class DemoBannerComponent {
  readonly show = environment.demoBanner;
}
