import { TestBed } from '@angular/core/testing';
import { HapticsService } from './haptics.service';

describe('HapticsService', () => {
  let vibrate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
  });
  afterEach(() => Reflect.deleteProperty(navigator, 'vibrate'));

  it('gives a short tick for a tap, a double tick for success and a stronger buzz for a failure', () => {
    const haptics = TestBed.inject(HapticsService);
    haptics.tap();
    haptics.success();
    haptics.error();
    expect(vibrate.mock.calls).toEqual([[8], [[12, 45, 12]], [[35, 50, 35]]]);
  });

  it('ticks for a touch on a button, not for a mouse and not for a disabled button', () => {
    const haptics = TestBed.inject(HapticsService);
    haptics.listen();
    const enabledButton = document.createElement('button');
    const disabledButton = document.createElement('button');
    disabledButton.disabled = true;
    document.body.append(enabledButton, disabledButton);
    const press = (element: Element, pointerType: string) => {
      const event = new Event('pointerdown', { bubbles: true });
      Object.defineProperty(event, 'pointerType', { value: pointerType });
      element.dispatchEvent(event);
    };
    press(enabledButton, 'mouse');
    press(disabledButton, 'touch');
    expect(vibrate).not.toHaveBeenCalled();
    press(enabledButton, 'touch');
    expect(vibrate).toHaveBeenCalledWith(8);
  });
});
