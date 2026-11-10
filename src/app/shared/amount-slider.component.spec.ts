import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AmountSliderComponent } from './amount-slider.component';

function render(min: number, max: number, step: number, value: number) {
  const fixture = TestBed.createComponent(AmountSliderComponent);
  fixture.componentRef.setInput('min', min);
  fixture.componentRef.setInput('max', max);
  fixture.componentRef.setInput('step', step);
  fixture.componentRef.setInput('value', value);
  fixture.detectChanges();
  return fixture;
}

describe('AmountSliderComponent', () => {
  it('offers a quarter, half, three quarters and the maximum, each on a valid step', () => {
    const chips = [...render(50_000, 300_000, 5_000, 300_000).nativeElement.querySelectorAll('.chip')].map((c) => c.textContent.trim());
    expect(chips).toHaveLength(4);
    expect(chips.at(-1)).toContain('300,000');
    expect(chips[0]).toContain('115,000');
  });

  it('marks the chip that matches the current amount', () => {
    const pressed = render(50_000, 300_000, 5_000, 175_000).nativeElement.querySelectorAll('.chip[aria-pressed="true"]');
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toContain('175,000');
  });

  it('emits the chosen amount when a chip is tapped', () => {
    const fixture = render(50_000, 300_000, 5_000, 300_000);
    const seen: number[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => seen.push(v));
    fixture.nativeElement.querySelectorAll('.chip')[1].click();
    expect(seen).toEqual([175_000]);
  });

  it('fills the track in proportion to the amount', () => {
    const fixture = render(0, 100, 1, 25);
    expect(fixture.nativeElement.querySelector('.slider').style.getPropertyValue('--pct')).toBe('25%');
  });
});
