import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LangService } from '../../core/i18n/lang.service';
import { LANGUAGES, Lang } from '../../core/i18n/translations';
import { RadioGroupDirective } from '../../core/a11y/radio-group.directive';
import { TPipe } from '../../core/i18n/t.pipe';
import { ReadAloudComponent } from '../apply/read-aloud.component';

@Component({
  selector: 'app-language-select',
  imports: [TPipe, ReadAloudComponent, RadioGroupDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './language-select.component.html',
  styleUrl: './language-select.component.css',
})
export class LanguageSelectComponent {
  private readonly langService = inject(LangService);
  private readonly router = inject(Router);

  readonly languages = LANGUAGES;
  readonly selected = signal<Lang>(this.langService.lang());
  readonly currentLang = computed(() => this.langService.lang());

  choose(lang: Lang): void {
    this.selected.set(lang);
    this.langService.set(lang);
  }

  continue(): void {
    this.langService.set(this.selected());
    this.router.navigateByUrl('/apply');
  }
}
