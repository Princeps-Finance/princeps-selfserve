import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AppUpdateService } from './app-update.service';
import { PwaBannerComponent } from './pwa-banner.component';

describe('PwaBannerComponent', () => {
  const updateReady = signal(false);
  const offline = signal(false);
  const apply = vi.fn();

  beforeEach(() => {
    // The test DOM has no native <dialog> behaviour.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); };
    updateReady.set(false);
    offline.set(false);
    apply.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: PwaBannerComponent },
          ...['status', 'welcome', 'bvn', 'profile', 'employment', 'offers', 'documents'].map((p) => ({
            path: 'apply/' + p,
            component: PwaBannerComponent,
          })),
        ]),
        { provide: AppUpdateService, useValue: { updateReady, offline, apply } },
      ],
    });
  });

  async function at(url: string) {
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(PwaBannerComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('tells the customer about a ready update on every step after the start, even mid-application', async () => {
    updateReady.set(true);
    for (const path of ['/apply/bvn', '/apply/profile', '/apply/employment', '/apply/offers', '/apply/documents', '/apply/status']) {
      const f = await at(path);
      expect(f.componentInstance.showUpdate()).toBe(true);
    }
    expect(apply).not.toHaveBeenCalled();
  });

  it('updates and reloads when the customer taps Update', async () => {
    updateReady.set(true);
    const f = await at('/apply/status');
    f.nativeElement.querySelector('.update .cta').click();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('applies a ready update by itself on the welcome and start screens, with no window', async () => {
    updateReady.set(true);
    for (const path of ['/apply/welcome', '/']) {
      apply.mockClear();
      const f = await at(path);
      TestBed.tick();
      expect(apply).toHaveBeenCalled();
      expect(f.componentInstance.showUpdate()).toBe(false);
    }
  });

  it('shows an offline notice anywhere without covering controls', async () => {
    offline.set(true);
    const el = (await at('/apply/status')).nativeElement as HTMLElement;
    expect(el.querySelector('.banner--offline')).not.toBeNull();
  });
});
