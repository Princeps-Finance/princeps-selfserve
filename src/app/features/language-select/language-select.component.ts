import { Router } from '@angular/router';
import { IconComponent } from '../../shared/components/icon.component';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LangService } from '../../core/i18n/lang.service';
import { LANGUAGES, Lang } from '../../core/i18n/translations';
import { TPipe } from '../../core/i18n/t.pipe';
import { ReadAloudComponent } from '../../shared/components/read-aloud.component';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle.component';
import { TrustFooterComponent } from '../privacy/trust-footer.component';
import { BrandLogoComponent } from '../../shared/components/brand-logo.component';
import { PromoBannerComponent } from '../../shared/components/promo-banner.component';
import { InstallService } from '../../core/pwa/install.service';
import { APPLY } from '../apply/apply-routes';

@Component({
  selector: 'app-language-select',
  imports: [IconComponent, TPipe, ReadAloudComponent, ThemeToggleComponent, BrandLogoComponent, TrustFooterComponent, PromoBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './language-select.component.html',
  styleUrl: './language-select.component.css',
})
export class LanguageSelectComponent {
  private readonly langService = inject(LangService);
  private readonly router = inject(Router);
  protected readonly install = inject(InstallService);

  readonly languages = LANGUAGES;

  /** A tap picks the language and moves on. Nothing is pre-selected, not even English. */
  async choose(language: Lang): Promise<void> {
    if (!(await this.langService.set(language))) return;
    void this.router.navigateByUrl(APPLY.root);
  }
}
