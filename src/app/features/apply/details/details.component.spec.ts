import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ApplicationApi } from '../data-access/application.api';
import { ReferenceDataStore } from '../data-access/reference-data.store';
import { DetailsComponent } from './details.component';

describe('details form validation', () => {
  it('checks each profile field and keeps the prefilled email read-only', async () => {
    const saveProfile = vi.fn();
    let resolveProfile!: (value: unknown) => void;
    const profile = new Promise((resolve) => (resolveProfile = resolve));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { page: 'profile' }, queryParamMap: convertToParamMap({}) },
          },
        },
        { provide: ApplicationApi, useValue: { getProfile: () => profile, saveProfile } },
        { provide: ReferenceDataStore, useValue: { states: async () => [] } },
      ],
    });

    const fixture = TestBed.createComponent(DetailsComponent);
    const screen = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(screen.querySelector('app-spinner')).not.toBeNull();

    resolveProfile({ profile: { email: 'ada@example.test' } });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(screen.querySelector('app-spinner')).toBeNull();
    });
    const email = screen.querySelector<HTMLInputElement>('#email')!;
    expect(email.value).toBe('ada@example.test');
    expect(email.readOnly).toBe(true);

    screen.querySelector<HTMLButtonElement>('form .cta')!.click();
    await fixture.whenStable();
    expect(saveProfile).not.toHaveBeenCalled();
    expect(screen.querySelector('#street')?.getAttribute('aria-describedby')).toBe('street-error');
    expect(screen.querySelector('#street-error')?.textContent).toContain('street address');
    expect(screen.querySelector('#state-error')?.textContent).toContain('Choose a state');
    expect(screen.querySelector('#lga-error')).not.toBeNull();
    expect(screen.textContent).not.toContain('Check the required fields');

    const street = screen.querySelector<HTMLInputElement>('#street')!;
    street.value = '10 Example Road';
    street.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(screen.querySelector('#street-error')).toBeNull();
    expect(screen.querySelector('#state-error')).not.toBeNull();
  });

  it('opens the dedicated state-employer screen for state government customers', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { page: 'employment' } } } },
        { provide: ApplicationApi, useValue: {} },
        {
          provide: ReferenceDataStore,
          useValue: {
            employmentTypes: async () => [
              { code: 'state', name: 'State government', status: 'AVAILABLE' },
            ],
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(DetailsComponent);
    const screen = fixture.nativeElement as HTMLElement;
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await fixture.whenStable();
    screen.querySelector<HTMLButtonElement>('button[role="radio"]')!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/apply/state');
  });
});
