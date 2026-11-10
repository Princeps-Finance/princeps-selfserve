import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LangService } from '../../core/i18n/lang.service';
import { LANGUAGES, Lang } from '../../core/i18n/translations';
import { TPipe } from '../../core/i18n/t.pipe';
import { ReadAloudComponent } from '../apply/read-aloud.component';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { BrandLogoComponent } from '../../shared/brand-logo.component';
import { PromoBannerComponent } from '../../shared/promo-banner.component';
import { InstallService } from '../../core/pwa/install.service';

@Component({
  selector: 'app-language-select',
  imports: [TPipe, ReadAloudComponent, ThemeToggleComponent, BrandLogoComponent, PromoBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './language-select.component.html',
  styleUrl: './language-select.component.css',
})
export class LanguageSelectComponent {
  private readonly langService = inject(LangService);
  private readonly router = inject(Router);
  protected readonly install = inject(InstallService);

  readonly languages = LANGUAGES;
  /** Highlight a language only once the customer has actually chosen one, so nothing looks already done. */
  readonly current = computed(() => (this.langService.hasChosen() ? this.langService.lang() : null));

  /** One tap picks the language and moves on, there is nothing else to answer on this screen. */
  choose(lang: Lang): void {
    this.langService.set(lang);
    void this.router.navigateByUrl('/apply');
  }
}
