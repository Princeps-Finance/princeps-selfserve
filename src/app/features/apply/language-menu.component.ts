import { IconComponent } from '../../shared/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LangService } from '../../core/i18n/lang.service';
import { LANGUAGES, Lang } from '../../core/i18n/translations';
import { TPipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-language-menu',
  imports: [IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocClick($event)',
    '(document:keydown.escape)': 'close()',
  },
  template: `
    <div class="wrap" #wrap>
      <button
        #trigger
        type="button"
        class="trigger glass-pill"
        [attr.aria-haspopup]="'listbox'"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="'apply.language' | t"
        (click)="toggle($event)"
      >
        <span class="current" aria-hidden="true">{{ currentLang().toUpperCase() }}</span><span class="vh">{{ currentEndonym() }}</span>
        <app-icon name="bold-chevron-down" [size]="12" class="caret" [class.is-open]="open()" />
      </button>

      @if (open()) {
        <ul class="menu" role="listbox" [attr.aria-label]="'apply.language' | t">
          @for (l of languages; track l.code) {
            <li>
              <button
                type="button"
                class="option"
                role="option"
                [attr.aria-selected]="l.code === currentLang()"
                [class.is-current]="l.code === currentLang()"
                (click)="pick(l.code)"
              >
                <span class="option-endonym">{{ l.endonym }}</span>
                <span class="option-english">{{ l.english }}</span>
                @if (l.code === currentLang()) {
                  <app-icon name="bold-success" [size]="14" class="check" />
                }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .wrap { position: relative; display: inline-flex; }
      .trigger {
        display: inline-flex; align-items: center; gap: var(--space-2);
        min-height: 44px; min-width: 44px; padding: 0 var(--space-2);
        letter-spacing: 0.04em;
        font-family: var(--font-sans);
        font-size: var(--fs-sm); font-weight: 500; color: var(--ink);
        cursor: pointer;
        transition: background 160ms ease, border-color 160ms ease;
      }
      .trigger:focus-visible {
        outline: 2px solid transparent; outline-offset: 2px;
        box-shadow: var(--focus-ring);
      }
      .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .caret { transition: transform 180ms cubic-bezier(0.2, 0.7, 0.1, 1); color: var(--ink-soft); }
      .caret.is-open { transform: rotate(180deg); }
      .menu {
        position: absolute; top: calc(100% + 8px); right: 0;
        min-width: 220px;
        list-style: none; margin: 0; padding: var(--space-2);
        background: var(--surface-0);
        border: 1px solid var(--hairline-strong);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-3);
        z-index: 40;
        animation: menu-in 160ms cubic-bezier(0.2, 0.7, 0.1, 1) both;
        transform-origin: top right;
      }
      @keyframes menu-in {
        from { opacity: 0; transform: translateY(-4px) scale(0.98); }
        to { opacity: 1; transform: none; }
      }
      .option {
        width: 100%;
        display: grid; grid-template-columns: 1fr auto auto; align-items: baseline;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-3);
        background: transparent; border: none; border-radius: var(--radius-sm);
        cursor: pointer; text-align: left; color: var(--ink);
        font-family: var(--font-sans);
      }
      .option:focus-visible { background: var(--canvas); outline: 2px solid transparent; outline-offset: 2px; }
      @media (hover: hover) and (pointer: fine) { .option:hover { background: var(--canvas); } }
      .option-endonym {
        font-family: var(--font-display); font-size: var(--fs-body); font-weight: 500;
        letter-spacing: -0.01em;
      }
      .option-english { font-size: var(--fs-xs); color: var(--ink-muted); }
      .check { color: var(--text-accent); }
      .option.is-current .option-endonym { color: var(--text-accent); }
      @media (prefers-reduced-motion: reduce) {
        .caret, .menu { animation: none; transition: none; }
      }
    `,
  ],
})
export class LanguageMenuComponent {
  private readonly langService = inject(LangService);
  private readonly wrap = viewChild<ElementRef<HTMLElement>>('wrap');

  readonly languages = LANGUAGES;
  readonly open = signal(false);
  readonly currentLang = computed(() => this.langService.lang());

  currentEndonym(): string {
    return LANGUAGES.find((l) => l.code === this.langService.lang())?.endonym ?? 'English';
  }

  toggle(evt: Event): void {
    evt.stopPropagation();
    this.open.update((v) => !v);
  }

  pick(lang: Lang): void {
    this.langService.set(lang);
    this.open.set(false);
  }

  close(): void {
    this.open.set(false);
  }

  onDocClick(evt: MouseEvent): void {
    if (!this.open()) return;
    const el = this.wrap()?.nativeElement;
    if (el && !el.contains(evt.target as Node)) this.close();
  }
}
