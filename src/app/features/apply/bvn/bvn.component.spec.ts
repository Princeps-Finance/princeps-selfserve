import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { BvnComponent } from './bvn.component';

function create(setup: (s: ApplicationStateService) => void) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: API_CLIENT, useValue: {} }] });
  setup(TestBed.inject(ApplicationStateService));
  return TestBed.createComponent(BvnComponent).componentInstance;
}

describe('BvnComponent never shows an earlier visit\'s BVN', () => {
  it('leaves the field empty when the BVN in memory was already verified', () => {
    const c = create((s) => s.setBvn({ value: '12345678901', verified: true }));
    expect(c.bvn.value).toBe('');
  });

  it('brings back a BVN typed a moment ago and not yet verified (going back from the code screen)', () => {
    const c = create((s) => s.setBvn({ value: '12345678901', verified: false }));
    expect(c.bvn.value).toBe('12345678901');
  });
});
