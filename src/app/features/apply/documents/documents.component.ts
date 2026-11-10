import { logWarn } from '../../../core/log';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { API_CLIENT } from '../../../core/api/api-client';
import { ApplicationStateService, DocDraft } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

interface DocSpec {
  id: string;
  labelKey: string;
  hintKey: string;
}

const BASE_DOCS: DocSpec[] = [
  { id: 'id', labelKey: 'step.docs.id', hintKey: 'step.docs.id.hint' },
];

const SALARIED: DocSpec = { id: 'payslip', labelKey: 'step.docs.payslip', hintKey: 'step.docs.payslip.hint' };
const CORPER: DocSpec = { id: 'callup', labelKey: 'step.docs.callup', hintKey: 'step.docs.callup.hint' };

@Component({
  selector: 'app-documents',
  imports: [TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.css',
})
export class DocumentsComponent implements OnInit {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  readonly specs = signal<DocSpec[]>([]);
  readonly docs = this.state.docs;
  readonly errors = signal<Record<string, 'too-large' | 'network' | 'bad-type' | null>>({});

  readonly attempted = signal(false);

  readonly allUploaded = computed(() => {
    const s = this.specs();
    const d = this.docs();
    if (!s.length) return false;
    return s.every((spec) => d.find((x) => x.id === spec.id)?.status === 'uploaded');
  });

  async ngOnInit(): Promise<void> {
    const employment = this.state.employment()?.type;
    const specs = [...BASE_DOCS, employment === 'corper' ? CORPER : SALARIED];
    this.specs.set(specs);

    // Initialize docs list.
    const existing = this.docs();
    const seeded: DocDraft[] = specs.map((s) => {
      const found = existing.find((d) => d.id === s.id);
      if (!found) return { id: s.id, name: s.labelKey, status: 'pending' };
      // An upload cut short by leaving the page never finished: let the customer try again.
      return found.status === 'uploading' ? { ...found, status: 'failed' } : found;
    });
    this.state.setDocs(seeded);
  }

  docFor(id: string): DocDraft | undefined {
    return this.docs().find((d) => d.id === id);
  }

  onFile(id: string, evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    void this.upload(id, file);
    input.value = '';
  }

  async upload(id: string, file: File): Promise<void> {
    this.errors.update((e) => ({ ...e, [id]: null }));
    this.state.updateDoc(id, { status: 'uploading', fileName: file.name });
    let res: Awaited<ReturnType<typeof this.api.uploadDocument>>;
    try {
      res = await this.api.uploadDocument({ docId: id, fileName: file.name, sizeBytes: file.size });
    } catch (err) {
        logWarn('documents step 1 failed', err);
res = { status: 'network' };
    }
    if (res.status === 'ok') {
      this.state.updateDoc(id, { status: 'uploaded' });
    } else {
      this.state.updateDoc(id, { status: 'failed' });
      this.errors.update((e) => ({ ...e, [id]: res.status as 'too-large' | 'network' | 'bad-type' }));
    }
  }

  continue(): void {
    if (!this.allUploaded()) {
      this.attempted.set(true);
      setTimeout(() => document.getElementById('docs-error')?.focus());
      return;
    }
    void this.flow.go(APPLY.verifyIdentity);
  }
}
