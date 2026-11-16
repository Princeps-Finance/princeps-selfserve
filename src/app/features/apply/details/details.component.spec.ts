import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
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

  it('requires a state before showing its employers and clears the employer when the state changes', async () => {
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
            mdas: async () => [
              { code: 'ondo-education', name: 'Education', state: 'Ondo' },
              { code: 'lagos-works', name: 'Works', state: 'Lagos' },
            ],
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(DetailsComponent);
    const screen = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    screen.querySelector<HTMLButtonElement>('button[role="radio"]')!.click();
    await fixture.whenStable();
    expect(screen.querySelector('#mda')).toBeNull();

    const { employmentForm, mdaOptions } = fixture.componentInstance;
    employmentForm.controls.mdaState.setValue('Ondo');
    expect(mdaOptions().map((option) => option.value)).toEqual(['ondo-education']);
    screen.querySelector<HTMLButtonElement>('form .cta')!.click();
    await fixture.whenStable();
    expect(screen.querySelector('#mda-error')).not.toBeNull();

    employmentForm.controls.mdaCode.setValue('ondo-education');
    expect(employmentForm.valid).toBe(true);
    employmentForm.controls.mdaState.setValue('Lagos');
    expect(mdaOptions().map((option) => option.value)).toEqual(['lagos-works']);
    expect(employmentForm.controls.mdaCode.value).toBe('');
    expect(employmentForm.invalid).toBe(true);
  });
});
