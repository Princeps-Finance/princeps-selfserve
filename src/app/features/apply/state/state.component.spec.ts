import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApplicationApi } from '../data-access/application.api';
import { ReferenceDataStore } from '../data-access/reference-data.store';
import { ApplicationStore } from '../state/application.store';
import { StateComponent } from './state.component';

describe('StateComponent', () => {
  it('filters employers by state and clears a previous employer when the state changes', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ApplicationApi, useValue: { saveEmployment: vi.fn() } },
        {
          provide: ApplicationStore,
          useValue: {
            errors: signal({}),
            pending: signal({}),
            save: vi.fn(),
          },
        },
        {
          provide: ReferenceDataStore,
          useValue: {
            mdas: async () => [
              { code: 'ondo-education', name: 'Education', state: 'Ondo' },
              { code: 'lagos-works', name: 'Works', state: 'Lagos' },
            ],
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(StateComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance;

    expect(component.states().map((option) => option.value)).toEqual(['Lagos', 'Ondo']);
    component.form.controls.state.setValue('Ondo');
    expect(component.employers().map((option) => option.value)).toEqual(['ondo-education']);

    component.form.controls.mdaCode.setValue('ondo-education');
    component.form.controls.state.setValue('Lagos');
    expect(component.employers().map((option) => option.value)).toEqual(['lagos-works']);
    expect(component.form.controls.mdaCode.value).toBe('');
  });
});
