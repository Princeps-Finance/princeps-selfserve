import { TestBed } from '@angular/core/testing';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { ProfileComponent } from './profile.component';

const identity = {
  firstName: 'Ada', fullName: 'Ada Okafor', dateOfBirth: '1988-04-12', phone: '08012345678',
  address: { street: '12 Allen Avenue', state: 'Lagos', lga: 'Ikeja' },
};

function create(setup: (s: ApplicationStateService) => void) {
  TestBed.configureTestingModule({
    providers: [
      { provide: API_CLIENT, useValue: { getLgas: vi.fn().mockResolvedValue(['Ikeja', 'Surulere']), getRequiredProfileFields: vi.fn().mockResolvedValue([]) } },
      { provide: FlowNavigator, useValue: { go: vi.fn() } },
    ],
  });
  setup(TestBed.inject(ApplicationStateService));
  return TestBed.createComponent(ProfileComponent).componentInstance;
}

describe('ProfileComponent asks for religion only when the back end lists it', () => {
  function withFields(fields: { key: string; optional: boolean }[]) {
    TestBed.configureTestingModule({
      providers: [
        { provide: API_CLIENT, useValue: { getLgas: vi.fn().mockResolvedValue([]), getRequiredProfileFields: vi.fn().mockResolvedValue(fields) } },
        { provide: FlowNavigator, useValue: { go: vi.fn() } },
      ],
    });
    TestBed.inject(ApplicationStateService).setBvnIdentity(identity);
    return TestBed.createComponent(ProfileComponent).componentInstance;
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('shows no religion field when the back end does not list it', async () => {
    const c = withFields([]);
    await tick();
    expect(c.religionField()).toBeNull();
  });

  it('shows it, and lets the customer skip it, when it is optional', async () => {
    const c = withFields([{ key: 'religion', optional: true }]);
    await tick();
    expect(c.religionField()).not.toBeNull();
    expect(c.form.controls.religion.valid).toBe(true);
  });

  it('requires it when the back end says it is required', async () => {
    const c = withFields([{ key: 'religion', optional: false }]);
    await tick();
    expect(c.form.controls.religion.valid).toBe(false);
    c.form.controls.religion.setValue('prefer-not-to-say');
    expect(c.form.controls.religion.valid).toBe(true);
  });
});

describe('ProfileComponent fills in what the BVN gave', () => {
  it('fills in name, date of birth and the BVN address, which the customer can change', async () => {
    const c = create((s) => s.setBvnIdentity(identity));
    await new Promise((r) => setTimeout(r, 0));
    expect(c.form.getRawValue()).toMatchObject({ fullName: 'Ada Okafor', dateOfBirth: '1988-04-12', street: '12 Allen Avenue', stateName: 'Lagos', lga: 'Ikeja' });
  });

  it('still fills in name and date of birth when a saved application kept neither', () => {
    const c = create((s) => {
      s.setBvnIdentity(identity);
      s.setProfile({ fullName: 'Ada Okafor', dateOfBirth: '', address: { street: 'My new street 5', state: 'Lagos', lga: 'Surulere' }, relationshipStatus: 'married' });
    });
    expect(c.form.getRawValue()).toMatchObject({ fullName: 'Ada Okafor', dateOfBirth: '1988-04-12', street: 'My new street 5', lga: 'Surulere', relationshipStatus: 'married' });
  });
});
