import { TestBed } from '@angular/core/testing';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService } from '../../../core/application/application-state.service';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';
import { DocumentsComponent } from './documents.component';

function setup(getRequiredDocuments: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    providers: [
      { provide: API_CLIENT, useValue: { getRequiredDocuments, uploadDocument: vi.fn() } },
      { provide: FlowNavigator, useValue: { go: vi.fn() } },
    ],
  });
  const state = TestBed.inject(ApplicationStateService);
  state.setEmployment({ type: 'government', governmentLevel: 'federal' });
  return { state, c: TestBed.createComponent(DocumentsComponent).componentInstance };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('DocumentsComponent asks only for what the back end returns', () => {
  it('shows exactly the returned documents, with a generic card for a key it does not know', async () => {
    const { c } = setup(vi.fn().mockResolvedValue([{ key: 'id', optional: false }, { key: 'utility-bill', optional: false }]));
    await tick();
    expect(c.specs().map((s) => s.id)).toEqual(['id', 'utility-bill']);
    expect(c.specs()[1].labelKey).toBe('step.docs.other');
  });

  it('asks for no payslip when the back end does not ask for one', async () => {
    const { c } = setup(vi.fn().mockResolvedValue([{ key: 'id', optional: false }]));
    await tick();
    expect(c.specs().some((s) => s.id === 'payslip')).toBe(false);
  });

  it('cannot continue, and shows an error, when the list cannot be loaded', async () => {
    const { c } = setup(vi.fn().mockRejectedValue(new Error('down')));
    await tick();
    expect(c.loadState()).toBe('error');
    expect(c.allUploaded()).toBe(false);
  });

  it('does not block on an optional document', async () => {
    const { c, state } = setup(vi.fn().mockResolvedValue([{ key: 'id', optional: false }, { key: 'payslip', optional: true }]));
    await tick();
    state.setDocs([{ id: 'id', name: 'x', status: 'uploaded' }, { id: 'payslip', name: 'y', status: 'pending' }]);
    expect(c.allUploaded()).toBe(true);
  });
});
