import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ApplicationApi } from '../data-access/application.api';
import { ReferenceDataStore } from '../data-access/reference-data.store';
import type { ApplicationViewDto } from '../data-access/application-contract';
import { ApplicationStore, stepRoutes } from '../state/application.store';
import { ApplicationSession } from '../../../core/session/application-session.service';
import { FEATURES } from '../../../core/features';
import { DetailsComponent } from './details.component';

function application(overrides: Partial<ApplicationViewDto> = {}): ApplicationViewDto {
  return {
    id: 'test-id',
    status: 'DRAFT',
    reference: null,
    suggestedNext: 'salary',
    returningCustomer: false,
    otpVerified: true,
    createdAt: '',
    updatedAt: '',
    steps: Object.fromEntries(
      Object.keys(stepRoutes).map((key, index) => [key, { step: index + 1, status: 'PENDING' }]),
    ) as ApplicationViewDto['steps'],
    employment: { type: 'federal' },
    ...overrides,
  };
}

async function salaryScreen(options: { remita: boolean; app?: ApplicationViewDto }) {
  const saveSalary = vi.fn(async () => ({}));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { data: { page: 'salary' } } } },
      { provide: FEATURES, useValue: { remitaSalary: options.remita } },
      {
        provide: ApplicationApi,
        useValue: {
          saveSalary,
          getApplication: async () => options.app ?? application(),
          resolveBankAccount: async () => ({ accountName: 'ADA OKAFOR', nameMatchesBvn: true }),
        },
      },
      { provide: ReferenceDataStore, useValue: { banks: async () => [] } },
    ],
  });
  TestBed.inject(ApplicationSession).establish('test-id', 'fixture-token');
  TestBed.inject(ApplicationStore).setApplication(options.app ?? application());
  const fixture = TestBed.createComponent(DetailsComponent);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  await fixture.whenStable();
  fixture.detectChanges();
  const component = fixture.componentInstance;
  const screen = fixture.nativeElement as HTMLElement;
  const fill = async (ippisNumber = '') => {
    component.salaryForm.patchValue({ bankCode: '058', accountNumber: '0123456789', ippisNumber });
    await vi.waitFor(() => expect(component.lookup()?.nameMatchesBvn).toBe(true));
  };
  const save = async () => {
    await component.save();
    fixture.detectChanges();
  };
  const choose = (label: 'IPPIS' | 'Remita') => {
    [...screen.querySelectorAll<HTMLButtonElement>('button[role="radio"]')]
      .find((button) => button.textContent?.trim() === label)!
      .click();
    fixture.detectChanges();
  };
  return { component, screen, saveSalary, navigate, fill, save, choose };
}

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

describe('federal salary: IPPIS or Remita', () => {
  it("keeps today's screen and payload while the Remita switch is off", async () => {
    const view = await salaryScreen({ remita: false });
    expect(view.screen.querySelector('[role="radiogroup"]')).toBeNull();
    expect(view.screen.querySelector('#ippis')).not.toBeNull();
    await view.fill('123456');
    await view.save();
    expect(view.saveSalary).toHaveBeenCalledWith({
      bankCode: '058',
      accountNumber: '0123456789',
      ippisNumber: '123456',
    });
  });

  it('sends Remita without an IPPIS number and hides the IPPIS field', async () => {
    const view = await salaryScreen({ remita: true });
    view.choose('Remita');
    expect(view.screen.querySelector('#ippis')).toBeNull();
    expect(view.screen.querySelector('#bank')).not.toBeNull();
    expect(view.screen.querySelector('#account')).not.toBeNull();
    await view.fill('999999');
    await view.save();
    expect(view.saveSalary).toHaveBeenCalledWith({
      payrollMethod: 'remita',
      bankCode: '058',
      accountNumber: '0123456789',
    });
    expect(view.navigate).toHaveBeenCalledWith('/apply/eligibility', {
      state: { checkEligibility: true },
    });
  });

  it('requires the IPPIS number for IPPIS and sends it', async () => {
    const view = await salaryScreen({ remita: true });
    expect(view.component.payrollMethod()).toBe('ippis');
    await view.fill();
    await view.save();
    expect(view.saveSalary).not.toHaveBeenCalled();
    expect(view.screen.querySelector('#ippis-error')).not.toBeNull();

    view.component.salaryForm.patchValue({ ippisNumber: '123456' });
    await view.save();
    expect(view.saveSalary).toHaveBeenCalledWith({
      payrollMethod: 'ippis',
      bankCode: '058',
      accountNumber: '0123456789',
      ippisNumber: '123456',
    });
  });

  it('restores Remita on resume and defaults older records to IPPIS', async () => {
    const salary = {
      bankCode: '058',
      accountName: 'ADA OKAFOR',
      accountNumberMasked: '******6789',
    };
    const resumed = await salaryScreen({
      remita: true,
      app: application({ salary: { ...salary, payrollMethod: 'remita' } }),
    });
    expect(resumed.component.payrollMethod()).toBe('remita');
    TestBed.resetTestingModule();
    const older = await salaryScreen({ remita: true, app: application({ salary }) });
    expect(older.component.payrollMethod()).toBe('ippis');
  });

  it('never offers the choice or sends payrollMethod outside federal', async () => {
    const view = await salaryScreen({
      remita: true,
      app: application({ employment: { type: 'nysc', monthsLeftInService: 6 } }),
    });
    expect(view.screen.querySelector('[role="radiogroup"]')).toBeNull();
    await view.fill();
    await view.save();
    expect(view.saveSalary).toHaveBeenCalledWith({ bankCode: '058', accountNumber: '0123456789' });
  });
});
