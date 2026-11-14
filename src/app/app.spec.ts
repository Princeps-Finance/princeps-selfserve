import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('hosts the router outlet, toast host and update banner', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('router-outlet')).toBeTruthy();
    expect(el.querySelector('app-privacy-dialog')).toBeNull();
    expect(el.querySelector('app-pwa-banner')).toBeTruthy();
    expect(el.querySelector('app-demo-banner')).toBeTruthy();
    expect(el.querySelector('app-toast-host')).toBeTruthy();
  });
});
