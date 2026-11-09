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
    updateReady.set(false);
    offline.set(false);
    apply.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: PwaBannerComponent },
          { path: 'apply/contact', component: PwaBannerComponent },
          { path: 'apply/status', component: PwaBannerComponent },
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
    return fixture.nativeElement as HTMLElement;
  }

  it('never offers an update in the middle of the application', async () => {
    updateReady.set(true);
    const el = await at('/apply/contact');
    expect(el.querySelector('.banner--update')).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });

  it('shows the Update button after submission, on the status page', async () => {
    updateReady.set(true);
    const el = await at('/apply/status');
    expect(el.querySelector('.banner--update')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('.action')!.click();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('applies a ready update by itself on the start screen', async () => {
    updateReady.set(true);
    await at('/');
    TestBed.tick();
    expect(apply).toHaveBeenCalled();
  });

  it('shows an offline notice anywhere without covering controls', async () => {
    offline.set(true);
    const el = await at('/apply/contact');
    expect(el.querySelector('.banner--offline')).not.toBeNull();
  });
});
