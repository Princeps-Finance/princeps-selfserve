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
      <aside class="demo" [attr.aria-label]="'demo.label' | t"><p>{{ 'demo.banner' | t }}</p></aside>
    }
  `,
  styles: [
    `
      .demo p { margin: 0; }
      .demo {
        margin: 0; padding: 6px var(--space-4); text-align: center;
        background: var(--navy-950); color: #fff; font-size: var(--fs-xs); line-height: 1.4;
      }
    `,
  ],
})
export class DemoBannerComponent {
  readonly show = environment.demoBanner;
}
