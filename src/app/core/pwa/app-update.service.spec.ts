import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { APP_VERSION } from '../app-version';
import { AppUpdateService } from './app-update.service';

describe('APP_VERSION', () => {
  it('is a semantic version', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
  });
});

describe('AppUpdateService', () => {
  function setup(enabled: boolean) {
    const versionUpdates = new Subject<{ type: string }>();
    const unrecoverable = new Subject<unknown>();
    const sw = {
      isEnabled: enabled,
      versionUpdates,
      unrecoverable,
      checkForUpdate: vi.fn().mockResolvedValue(false),
      activateUpdate: vi.fn().mockResolvedValue(true),
    };
    TestBed.configureTestingModule({ providers: [{ provide: SwUpdate, useValue: sw }] });
    return { sw, versionUpdates, unrecoverable, service: TestBed.inject(AppUpdateService) };
  }

  it('marks an update ready only when a new version is downloaded', () => {
    const { service, versionUpdates } = setup(true);
    expect(service.updateReady()).toBe(false);
    versionUpdates.next({ type: 'VERSION_DETECTED' });
    expect(service.updateReady()).toBe(false);
    versionUpdates.next({ type: 'VERSION_READY' });
    expect(service.updateReady()).toBe(true);
  });

  it('treats an unrecoverable cache as needing a reload', () => {
    const { service, unrecoverable } = setup(true);
    unrecoverable.next({});
    expect(service.updateReady()).toBe(true);
  });

  it('does nothing when the service worker is disabled (development)', () => {
    const { service, versionUpdates } = setup(false);
    versionUpdates.next({ type: 'VERSION_READY' });
    expect(service.updateReady()).toBe(false);
  });

  it('follows the browser online and offline events', () => {
    const { service } = setup(false);
    window.dispatchEvent(new Event('offline'));
    expect(service.offline()).toBe(true);
    window.dispatchEvent(new Event('online'));
    expect(service.offline()).toBe(false);
  });
});
