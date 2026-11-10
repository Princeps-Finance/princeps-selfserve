import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LangService } from '../../core/i18n/lang.service';
import { LANGUAGES, Lang } from '../../core/i18n/translations';
import { RadioGroupDirective } from '../../core/a11y/radio-group.directive';
import { TPipe } from '../../core/i18n/t.pipe';
import { ReadAloudComponent } from '../apply/read-aloud.component';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { TrustFooterComponent } from '../../shared/trust-footer.component';
import { BrandLogoComponent } from '../../shared/brand-logo.component';
import { PromoBannerComponent } from '../../shared/promo-banner.component';
import { InstallService } from '../../core/pwa/install.service';
import { APPLY } from '../../core/flow/apply-routes';
import { FlowNavigator } from '../../core/flow/flow-navigator.service';

@Component({
  selector: 'app-language-select',
  imports: [TPipe, RadioGroupDirective, ReadAloudComponent, ThemeToggleComponent, BrandLogoComponent, TrustFooterComponent, PromoBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './language-select.component.html',
  styleUrl: './language-select.component.css',
})
export class LanguageSelectComponent {
  private readonly langService = inject(LangService);
  private readonly flow = inject(FlowNavigator);
  protected readonly install = inject(InstallService);

  readonly languages = LANGUAGES;
  /** Highlight a language only once the customer has actually chosen one, so nothing looks already done. */
  readonly current = computed(() => (this.langService.hasChosen() ? this.langService.lang() : null));

  /** Picking a language switches the screen to it straight away, so the customer sees what they chose. */
  choose(lang: Lang): void {
    this.langService.set(lang);
  }

  /** Only the chosen language (or the first, before any choice) is in the tab order; arrow keys move between them. */
  tabFor(code: Lang, index: number): number {
    const chosen = this.current();
    return chosen ? (chosen === code ? 0 : -1) : index === 0 ? 0 : -1;
  }

  proceed(): void {
    if (this.current()) void this.flow.go(APPLY.root);
  }
}
