import { DestroyRef, Injectable, inject } from '@angular/core';

/** The things worth a buzz: pressing a button or a choice, and the two moments that matter (it worked, it did not). */
const PRESSABLE =
  'button, a.cta, a.alt, [role="radio"], [role="option"], [role="button"], label[for], app-checkbox, summary';

/**
 * Tactile feedback on phones. A short tick when something is pressed, a double tick for success and a stronger
 * buzz for a failure. It uses the Vibration API (Android browsers and installed apps). iPhone does not offer that
 * API, so there it falls back to the system's switch tick, which only newer iOS versions play; where neither exists
 * nothing happens. It never fires for a mouse, and stays silent for people who asked for reduced motion.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly canVibrate =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  private readonly reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly listeners = new AbortController();
  private listening = false;
  private tickLabel: HTMLLabelElement | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.listeners.abort();
      this.tickLabel?.remove();
    });
  }

  listen(): void {
    if (typeof document === 'undefined' || this.reduced || this.listening) return;
    this.listening = true;
    const passive = { passive: true, signal: this.listeners.signal };
    const press = (event: Event): void => {
      const control = (event.target as Element | null)?.closest?.(PRESSABLE);
      if (control && !control.matches(':disabled, [aria-disabled="true"]')) this.tap();
    };

    if (this.canVibrate) {
      document.addEventListener(
        'pointerdown',
        (event) => {
          if (event.pointerType === 'touch') press(event);
        },
        passive,
      );
      return;
    }

    // Safari needs a click within the touch gesture to play the switch tick.
    let touchGesture = false;
    document.addEventListener(
      'pointerdown',
      (event) => {
        touchGesture = event.pointerType === 'touch';
      },
      { ...passive, capture: true },
    );
    document.addEventListener(
      'click',
      (event) => {
        if (touchGesture && event.detail > 0) press(event);
        touchGesture = false;
      },
      { ...passive, capture: true },
    );
  }

  /** A soft tick for each step of a slider while it is dragged. */
  step(): void {
    this.buzz(5);
  }

  tap(): void {
    this.buzz(8);
  }

  success(): void {
    this.buzz([12, 45, 12]);
  }

  error(): void {
    this.buzz([35, 50, 35]);
  }

  private buzz(pattern: number | number[]): void {
    if (this.reduced) return;
    try {
      if (this.canVibrate) navigator.vibrate(pattern);
      else this.iosTick();
    } catch {
      /* haptics are a nicety: never let them break a screen */
    }
  }

  /** iPhone: a hidden switch toggled from a touch plays the system tick on iOS versions that support it. */
  private iosTick(): void {
    if (typeof document === 'undefined') return;
    if (!this.tickLabel) {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText =
        'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      // The hidden switch must never look like a click on the page: it would close open menus.
      label.addEventListener('click', (event) => event.stopPropagation());
      label.appendChild(input);
      document.body.appendChild(label);
      this.tickLabel = label;
    }
    this.tickLabel.click();
  }
}
