import { Injectable } from '@angular/core';
import { toLocationFix, type LocationFix } from './location-fix';

export type LocationResult =
  | { status: 'ok'; fix: LocationFix }
  | { status: 'denied' | 'unavailable' | 'timeout' | 'unsupported' };

/** How long to wait for the phone before saying it could not find the place. */
const WAIT_MS = 12_000;

/**
 * Asks the phone where it is. It must be called from a tap, because the browser only shows its permission prompt then,
 * and the customer can always say no: nothing in the application depends on the answer.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
  request(): Promise<LocationResult> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve({ status: 'unsupported' });
    return new Promise<LocationResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const fix = toLocationFix(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
          resolve(fix ? { status: 'ok', fix } : { status: 'unavailable' });
        },
        (err) => resolve({ status: err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable' }),
        { enableHighAccuracy: true, timeout: WAIT_MS, maximumAge: 0 },
      );
    });
  }
}
