import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { LangService } from '../../core/i18n/lang.service';

const VOICE_LOCALE: Record<string, string> = {
  en: 'en-NG',
  yo: 'yo-NG',
  ig: 'ig-NG',
  ha: 'ha-NG',
};

@Component({
  selector: 'app-read-aloud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="tts"
      (click)="toggle()"
      [class.is-speaking]="speaking()"
      [class.is-unavailable]="!hasVoice()"
      [disabled]="!supported()"
      [attr.aria-pressed]="speaking()"
      [attr.aria-label]="ariaLabel()"
      [attr.title]="titleAttr()"
    >
      @if (speaking()) {
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="6" y="6" width="4" height="12" rx="1" fill="currentColor"/>
          <rect x="14" y="6" width="4" height="12" rx="1" fill="currentColor"/>
        </svg>
      } @else {
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      }
    </button>
  `,
  styles: [
    `
      .tts {
        display: inline-flex; align-items: center; justify-content: center;
        width: 44px; height: 44px;
        background: transparent; border: 1px solid var(--hairline);
        color: var(--ink); border-radius: 50%;
        cursor: pointer;
        transition: background 160ms ease, color 160ms ease, border-color 160ms ease, transform 120ms ease-out;
      }
      .tts:hover:not(:disabled) { background: rgba(17,17,17,0.06); }
      .tts:active:not(:disabled) { transform: scale(0.96); }
      .tts:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--focus-ring); }
      .tts:disabled { opacity: 0.4; cursor: not-allowed; }
      .tts.is-speaking {
        background: var(--action-primary);
        color: var(--action-on-primary);
        border-color: var(--action-primary);
      }
      .tts.is-unavailable:not(:disabled) { opacity: 0.7; }
      @media (prefers-reduced-motion: reduce) {
        .tts { transition: none; }
      }
    `,
  ],
})
export class ReadAloudComponent implements OnDestroy {
  private readonly lang = inject(LangService);
  readonly speaking = signal(false);
  private readonly voicesTick = signal(0);

  readonly supported = computed(() =>
    typeof window !== 'undefined' && 'speechSynthesis' in window,
  );

  readonly hasVoice = computed(() => {
    this.voicesTick();
    return !!this.pickVoice();
  });

  readonly ariaLabel = computed(() => {
    if (this.speaking()) return 'Stop reading';
    if (!this.hasVoice()) return `Read aloud (using English — no ${this.lang.lang().toUpperCase()} voice on this device)`;
    return 'Read this screen aloud';
  });

  readonly titleAttr = computed(() => {
    if (this.speaking()) return 'Stop';
    if (!this.hasVoice()) return `No ${this.lang.lang().toUpperCase()} voice — will read in English`;
    return 'Read aloud';
  });

  private voicesHandler = () => this.voicesTick.update((v) => v + 1);

  constructor() {
    if (this.supported()) {
      window.speechSynthesis.addEventListener?.('voiceschanged', this.voicesHandler);
      this.voicesTick.update((v) => v + 1);
    }
  }

  ngOnDestroy(): void {
    if (this.supported()) {
      window.speechSynthesis.removeEventListener?.('voiceschanged', this.voicesHandler);
      window.speechSynthesis.cancel();
    }
  }

  toggle(): void {
    if (!this.supported()) return;
    const synth = window.speechSynthesis;
    if (this.speaking()) {
      synth.cancel();
      this.speaking.set(false);
      return;
    }
    const text = this.collectVisibleText();
    if (!text) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = this.pickVoice();
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else {
      utter.lang = 'en-NG';
    }
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.onend = () => this.speaking.set(false);
    utter.onerror = () => this.speaking.set(false);
    this.speaking.set(true);
    synth.speak(utter);
  }

  private pickVoice(): SpeechSynthesisVoice | null {
    if (!this.supported()) return null;
    const target = VOICE_LOCALE[this.lang.lang()] ?? 'en-NG';
    const base = target.split('-')[0];
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang.toLowerCase() === target.toLowerCase()) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(base + '-')) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
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
      .forEach((el) => {
        if (el.offsetParent === null) return;
        const t = (el.innerText ?? '').trim();
        if (t) parts.push(t);
      });
    return parts.join('. ');
  }
}
