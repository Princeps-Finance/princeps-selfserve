import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { IconComponent } from './icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { LangService } from '../../core/i18n/lang.service';

const VOICE_LOCALE: Record<string, string> = {
  en: 'en-NG',
  yo: 'yo-NG',
  ig: 'ig-NG',
  ha: 'ha-NG',
};

@Component({
  imports: [IconComponent],
  selector: 'app-read-aloud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="tts glass-btn"
      (click)="toggle()"
      [class.is-speaking]="speaking()"
      [class.is-unavailable]="!hasVoice()"
      [disabled]="!supported()"
      [attr.aria-pressed]="speaking()"
      [attr.aria-label]="ariaLabel()"
      [attr.title]="titleAttr()"
    >
      @if (speaking()) {
        <app-icon name="bold-pause" [size]="18" />
      } @else {
        <app-icon name="bold-volume" [size]="18" />
      }
    </button>
  `,
  styles: [
    `
      .tts {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        color: var(--ink);
        cursor: pointer;
        transition:
          background 160ms ease,
          color 160ms ease,
          border-color 160ms ease,
          transform 120ms ease-out;
      }
      .tts:active:not(:disabled) {
        transform: scale(0.96);
      }
      .tts:focus-visible {
        outline: 2px solid transparent;
        outline-offset: 2px;
        box-shadow: var(--focus-ring);
      }
      .tts:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .tts.is-speaking {
        background: var(--action-primary);
        color: var(--action-on-primary);
        border-color: var(--action-primary);
      }
      .tts.is-unavailable:not(:disabled) {
        opacity: 0.7;
      }
      @media (prefers-reduced-motion: reduce) {
        .tts {
          transition: none;
        }
      }
    `,
  ],
})
export class ReadAloudComponent implements OnDestroy {
  private readonly lang = inject(LangService);
  readonly speaking = signal(false);
  private readonly voicesTick = signal(0);

  readonly supported = computed(() => typeof window !== 'undefined' && 'speechSynthesis' in window);

  readonly hasVoice = computed(() => {
    this.voicesTick();
    return !!this.pickVoice();
  });

  readonly ariaLabel = computed(() => {
    this.lang.lang();
    if (this.speaking()) return this.lang.t('tts.stop');
    if (!this.hasVoice())
      return this.lang.t('tts.novoice').replace('{lang}', this.lang.lang().toUpperCase());
    return this.lang.t('tts.read');
  });

  readonly titleAttr = computed(() => this.ariaLabel());

  private utterance?: SpeechSynthesisUtterance;
  private readonly voicesHandler = () => this.voicesTick.update((revision) => revision + 1);

  constructor() {
    if (this.supported()) {
      window.speechSynthesis.addEventListener?.('voiceschanged', this.voicesHandler);
      this.voicesTick.update((revision) => revision + 1);
      inject(Router)
        .events.pipe(
          filter((event) => event instanceof NavigationStart),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.stopReading());
    }
  }

  ngOnDestroy(): void {
    if (this.supported()) {
      window.speechSynthesis.removeEventListener?.('voiceschanged', this.voicesHandler);
      this.stopReading();
    }
  }

  toggle(): void {
    if (!this.supported()) return;
    const synthesizer = window.speechSynthesis;
    if (this.speaking()) {
      this.stopReading();
      return;
    }
    const text = this.collectVisibleText();
    if (!text) return;
    synthesizer.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.pickVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'en-NG';
    }
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const finish = () => {
      if (this.utterance !== utterance) return;
      this.utterance = undefined;
      this.speaking.set(false);
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    this.utterance = utterance;
    this.speaking.set(true);
    synthesizer.speak(utterance);
  }

  private stopReading(): void {
    const utterance = this.utterance;
    if (!utterance) return;
    this.utterance = undefined;
    utterance.onend = null;
    utterance.onerror = null;
    window.speechSynthesis.cancel();
    this.speaking.set(false);
  }

  private pickVoice(): SpeechSynthesisVoice | null {
    if (!this.supported()) return null;
    const target = VOICE_LOCALE[this.lang.lang()] ?? 'en-NG';
    const base = target.split('-')[0];
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((voice) => voice.lang.toLowerCase() === target.toLowerCase()) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith(base + '-')) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith(base)) ??
      null
    );
  }

  private collectVisibleText(): string {
    if (typeof document === 'undefined') return '';
    const main = document.querySelector('main.body') ?? document.querySelector('main');
    if (!main) return '';
    const parts: string[] = [];
    main
      .querySelectorAll<HTMLElement>(
        'h1, h2, h3, p, label, .eyebrow, .subtitle, dd, dt, li, button',
      )
      .forEach((element) => {
        if (element.offsetParent === null) return;
        const visibleText = (element.innerText ?? '').trim();
        if (visibleText) parts.push(visibleText);
      });
    return parts.join('. ');
  }
}
