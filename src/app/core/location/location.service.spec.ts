import { toLocationFix } from './location-fix';
import { LocationService } from './location.service';

function geo(impl: (ok: PositionCallback, fail: PositionErrorCallback) => void): void {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: impl } });
}

describe('toLocationFix', () => {
  it('keeps about a metre of detail and the accuracy', () => {
    const f = toLocationFix(6.601838, 3.351486, 12.6, new Date('2026-11-15T10:00:00Z'));
    expect(f).toEqual({ latitude: 6.60184, longitude: 3.35149, accuracyM: 13, capturedAt: '2026-11-15T10:00:00.000Z' });
  });

  it('refuses numbers that are not a place on earth', () => {
    expect(toLocationFix(91, 3, 5)).toBeNull();
    expect(toLocationFix(6, 181, 5)).toBeNull();
    expect(toLocationFix(NaN, 3, 5)).toBeNull();
    expect(toLocationFix('6', 3, 5)).toBeNull();
  });
});

describe('LocationService', () => {
  const service = new LocationService();

  it('returns the place the phone gives', async () => {
    geo((ok) => ok({ coords: { latitude: 6.5244, longitude: 3.3792, accuracy: 20 } } as GeolocationPosition));
    const r = await service.request();
    expect(r).toMatchObject({ status: 'ok', fix: { latitude: 6.5244, longitude: 3.3792, accuracyM: 20 } });
  });

  it('says denied when the customer says no, and timeout or unavailable otherwise', async () => {
    geo((_ok, fail) => fail({ code: 1 } as GeolocationPositionError));
    expect(await service.request()).toEqual({ status: 'denied' });
    geo((_ok, fail) => fail({ code: 3 } as GeolocationPositionError));
    expect(await service.request()).toEqual({ status: 'timeout' });
    geo((_ok, fail) => fail({ code: 2 } as GeolocationPositionError));
    expect(await service.request()).toEqual({ status: 'unavailable' });
  });

  it('treats a nonsense reading as unavailable', async () => {
    geo((ok) => ok({ coords: { latitude: 500, longitude: 3, accuracy: 5 } } as GeolocationPosition));
    expect(await service.request()).toEqual({ status: 'unavailable' });
  });

  it('says unsupported when the browser has no location', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    expect(await service.request()).toEqual({ status: 'unsupported' });
  });
});
