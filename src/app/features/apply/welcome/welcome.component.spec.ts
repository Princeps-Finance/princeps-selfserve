import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { WelcomeIntentComponent } from './welcome.component';

describe('WelcomeIntentComponent', () => {
  const original = environment.accountsUrl;
  afterEach(() => (environment.accountsUrl = original));

  function setup() {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(WelcomeIntentComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('links existing customers to Princeps Accounts once its address is set', () => {
    environment.accountsUrl = 'https://accounts.example.com';
    expect(setup().querySelector<HTMLAnchorElement>('.signin a.link')?.getAttribute('href')).toBe('https://accounts.example.com');
  });

  it('hides the sign-in link while the accounts app has no address', () => {
    environment.accountsUrl = '';
    expect(setup().querySelector('.signin')).toBeNull();
  });

  it('keeps both ways to start: applying and checking how much you can get', () => {
    const el = setup();
    expect(el.querySelector('button.cta')).not.toBeNull();
    expect(el.querySelector('button.alt')).not.toBeNull();
  });
});
