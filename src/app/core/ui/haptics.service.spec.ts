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
    const h = TestBed.inject(HapticsService);
    h.tap();
    h.success();
    h.error();
    expect(vibrate.mock.calls).toEqual([[8], [[12, 45, 12]], [[35, 50, 35]]]);
  });

  it('ticks for a touch on a button, not for a mouse and not for a disabled button', () => {
    const h = TestBed.inject(HapticsService);
    h.listen();
    const ok = document.createElement('button');
    const off = document.createElement('button');
    off.disabled = true;
    document.body.append(ok, off);
    const press = (el: Element, pointerType: string) => {
      const e = new Event('pointerdown', { bubbles: true });
      Object.defineProperty(e, 'pointerType', { value: pointerType });
      el.dispatchEvent(e);
    };
    press(ok, 'mouse');
    press(off, 'touch');
    expect(vibrate).not.toHaveBeenCalled();
    press(ok, 'touch');
    expect(vibrate).toHaveBeenCalledWith(8);
  });
});
