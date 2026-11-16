import { OverlayContainer } from '@angular/cdk/overlay';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AppUpdateService } from '../../core/pwa/app-update.service';
import { PwaBannerComponent } from './pwa-banner.component';

describe('PwaBannerComponent', () => {
  const updateReady = signal(false);
  const offline = signal(false);
  const apply = vi.fn();

  beforeEach(() => {
    updateReady.set(false);
    offline.set(false);
    apply.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: PwaBannerComponent },
          ...['status', 'welcome', 'bvn', 'profile', 'employment', 'offers', 'documents'].map((step) => ({
            path: 'apply/' + step,
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
      const fixture = await at(path);
      expect(fixture.componentInstance.showUpdate()).toBe(true);
    }
    expect(apply).not.toHaveBeenCalled();
  });

  it('updates and reloads when the customer taps Update', async () => {
    updateReady.set(true);
    const fixture = await at('/apply/status');
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(container.querySelector('.update .cta')).not.toBeNull();
    });
    container.querySelector<HTMLButtonElement>('.update .cta')!.click();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('opens the update prompt again from the chip after Later', async () => {
    updateReady.set(true);
    const fixture = await at('/apply/profile');
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(container.querySelector('.update .alt')).not.toBeNull();
    });
    container.querySelector<HTMLButtonElement>('.update .alt')!.click();
    fixture.detectChanges();
    const chip = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.update-chip');
    expect(chip?.textContent).toContain('Update available');
    chip!.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(container.querySelector('.update .cta')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.update-chip')).toBeNull();
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it('applies a ready update by itself on the welcome and start screens, with no window', async () => {
    updateReady.set(true);
    for (const path of ['/apply/welcome', '/']) {
      apply.mockClear();
      const fixture = await at(path);
      TestBed.tick();
      expect(apply).toHaveBeenCalled();
      expect(fixture.componentInstance.showUpdate()).toBe(false);
    }
  });

  it('shows an offline notice anywhere without covering controls', async () => {
    offline.set(true);
    const host = (await at('/apply/status')).nativeElement as HTMLElement;
    expect(host.querySelector('.banner--offline')).not.toBeNull();
  });
});
