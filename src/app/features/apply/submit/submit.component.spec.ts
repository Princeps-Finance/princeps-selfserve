import { TestBed } from '@angular/core/testing';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { LocationService } from '../../../core/location/location.service';
import { QuoteService } from '../../../core/pricing/quote.service';
import { SubmitComponent } from './submit.component';

const FIX = { latitude: 6.5244, longitude: 3.3792, accuracyM: 18, capturedAt: '2026-11-15T10:00:00.000Z' };

function setup(request: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    providers: [
      { provide: API_CLIENT, useValue: {} },
      { provide: FlowNavigator, useValue: { go: vi.fn() } },
      { provide: QuoteService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
      { provide: LocationService, useValue: { request } },
    ],
  });
  const fixture = TestBed.createComponent(SubmitComponent);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, state: TestBed.inject(ApplicationStateService) };
}

describe('SubmitComponent: share where you are', () => {
  it('is an optional step that starts unasked, and sharing keeps the place in memory', async () => {
    const { c, state } = setup(vi.fn().mockResolvedValue({ status: 'ok', fix: FIX }));
    expect(c.place()).toBe('idle');
    await c.shareLocation();
    expect(c.place()).toBe('shared');
    expect(state.locationFix()).toEqual(FIX);
    expect(c.accuracy()).toBe(18);
  });

  it('a refusal changes nothing and leaves the customer free to carry on', async () => {
    const { c, state } = setup(vi.fn().mockResolvedValue({ status: 'denied' }));
    await c.shareLocation();
    expect(c.place()).toBe('denied');
    expect(state.locationFix()).toBeNull();
    expect(c.canSubmit()).toBe(false); // still needs the agree box, never the location
    c.toggleAgree(true);
    expect(c.canSubmit()).toBe(true);
  });

  it('a phone that cannot find the place says so, and "do not share" clears a shared one', async () => {
    const { c, state } = setup(vi.fn().mockResolvedValueOnce({ status: 'timeout' }).mockResolvedValueOnce({ status: 'ok', fix: FIX }));
    await c.shareLocation();
    expect(c.place()).toBe('failed');
    await c.shareLocation();
    expect(c.place()).toBe('shared');
    c.stopSharing();
    expect(c.place()).toBe('idle');
    expect(state.locationFix()).toBeNull();
  });

  it('shows the shared state when a place is already held', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: API_CLIENT, useValue: {} }, { provide: FlowNavigator, useValue: { go: vi.fn() } }, { provide: QuoteService, useValue: {} }] });
    TestBed.inject(ApplicationStateService).setLocationFix(FIX);
    expect(TestBed.createComponent(SubmitComponent).componentInstance.place()).toBe('shared');
  });
});
