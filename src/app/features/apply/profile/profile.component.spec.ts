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
      { provide: API_CLIENT, useValue: { getLgas: vi.fn().mockResolvedValue(['Ikeja', 'Surulere']) } },
      { provide: FlowNavigator, useValue: { go: vi.fn() } },
    ],
  });
  setup(TestBed.inject(ApplicationStateService));
  return TestBed.createComponent(ProfileComponent).componentInstance;
}

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
