import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input, signal, viewChild } from '@angular/core';
import { IconComponent } from './icon.component';
import { IconName } from './icons/icons.generated';

/** The few Lottie files in public/animations that this component can play. */
export type AnimationName = 'arrow-right';

interface Player {
  goToAndPlay(value: number, isFrame: boolean): void;
  goToAndStop(value: number, isFrame: boolean): void;
  addEventListener(name: 'DOMLoaded', cb: () => void): void;
  destroy(): void;
}

/**
 * An Iconly Lottie icon that plays when the button around it is hovered, focused by keyboard or tapped.
 * Until the animation has loaded, and for people who ask for less motion, it shows the still icon instead.
 * The player library loads on its own, after the page, so it never slows the first screen.
 */
@Component({
  selector: 'app-animated-icon',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'animated-icon', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  template: `
    @if (!ready()) { <app-icon [name]="fallback()" [size]="size()" /> }
    <span #stage class="stage" [class.is-ready]="ready()"></span>
  `,
  styles: `
    :host { display: inline-flex; flex: none; position: relative; line-height: 0; }
    .stage { display: none; width: 100%; height: 100%; }
    .stage.is-ready { display: block; }
    /* The animation is drawn in black strokes: follow the button's text colour instead. */
    :host ::ng-deep svg path { stroke: currentColor !important; }
  `,
})
export class AnimatedIconComponent {
  readonly animation = input.required<AnimationName>();
  readonly fallback = input.required<IconName>();
  readonly size = input(18);

  protected readonly ready = signal(false);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => void this.start());
  }

  private async start(): Promise<void> {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const trigger = this.host.nativeElement.closest<HTMLElement>('button, a');
    if (!trigger) return;

    const { default: lottie } = await import('lottie-web/build/player/lottie_light');
    const player = lottie.loadAnimation({
      container: this.stage().nativeElement,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      path: `/animations/${this.animation()}.json`,
    }) as unknown as Player;
    player.addEventListener('DOMLoaded', () => {
      player.goToAndStop(0, true);
      this.ready.set(true);
    });

    const play = () => player.goToAndPlay(0, true);
    const rest = () => player.goToAndStop(0, true);
    const onFocus = () => { if (trigger.matches(':focus-visible')) play(); };
    trigger.addEventListener('pointerenter', play);
    trigger.addEventListener('pointerdown', play); // a tap on a phone has no hover
    trigger.addEventListener('focus', onFocus);
    trigger.addEventListener('pointerleave', rest);
    trigger.addEventListener('blur', rest);
    this.destroyRef.onDestroy(() => {
      trigger.removeEventListener('pointerenter', play);
      trigger.removeEventListener('pointerdown', play);
      trigger.removeEventListener('focus', onFocus);
      trigger.removeEventListener('pointerleave', rest);
      trigger.removeEventListener('blur', rest);
      player.destroy();
    });
  }
}
