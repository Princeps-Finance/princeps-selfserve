import { WhyAskComponent } from '../../../shared/why-ask.component';
import { logWarn } from '../../../core/log';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WizardProgressComponent } from '../wizard-progress.component';
import { API_CLIENT, RequiredDocument } from '../../../core/api/api-client';
import { ApplicationStateService, DocDraft } from '../../../core/application/application-state.service';
import { APPLY } from '../../../core/flow/apply-routes';
import { FlowNavigator } from '../../../core/flow/flow-navigator.service';

interface DocSpec {
  id: string;
  labelKey: string;
  hintKey: string;
  optional?: boolean;
}

/** The documents the app knows how to name. A key the back end adds that is not here still gets a generic card. */
const KNOWN: Record<string, DocSpec> = {
  id: { id: 'id', labelKey: 'step.docs.id', hintKey: 'step.docs.id.hint' },
  payslip: { id: 'payslip', labelKey: 'step.docs.payslip', hintKey: 'step.docs.payslip.hint' },
  callup: { id: 'callup', labelKey: 'step.docs.callup', hintKey: 'step.docs.callup.hint' },
};

function specFor(doc: RequiredDocument): DocSpec {
  const known = Object.hasOwn(KNOWN, doc.key) ? KNOWN[doc.key] : undefined;
  return { ...(known ?? { id: doc.key, labelKey: 'step.docs.other', hintKey: 'step.docs.other.hint' }), optional: doc.optional };
}

@Component({
  selector: 'app-documents',
  imports: [WhyAskComponent, TPipe, WizardProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.css',
})
export class DocumentsComponent implements OnInit {
  private readonly api = inject(API_CLIENT);
  private readonly state = inject(ApplicationStateService);
  private readonly flow = inject(FlowNavigator);

  readonly specs = signal<DocSpec[]>([]);
  /** The list comes from the back end. Until it arrives, or if it cannot be loaded, nothing can be sent. */
  readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  readonly docs = this.state.docs;
  readonly errors = signal<Record<string, 'too-large' | 'network' | 'bad-type' | null>>({});

  readonly attempted = signal(false);

  readonly allUploaded = computed(() => {
    const s = this.specs();
    const d = this.docs();
    if (this.loadState() !== 'ready') return false;
    return s.filter((spec) => !spec.optional).every((spec) => d.find((x) => x.id === spec.id)?.status === 'uploaded');
  });

  async ngOnInit(): Promise<void> {
    await this.loadList();
  }

  protected async loadList(): Promise<void> {
    const employment = this.state.employment()?.type;
    const offer = this.state.offer();
    this.loadState.set('loading');
    let list: RequiredDocument[];
    try {
      list = await this.api.getRequiredDocuments({
        productId: offer?.productId ?? '',
        employmentType: employment === 'corper' || employment === 'paramilitary' || employment === 'private-sector' ? employment : 'government',
      });
    } catch (err) {
      logWarn('required documents unavailable', err);
      this.loadState.set('error');
      return;
    }
    const specs = list.map(specFor);
    this.specs.set(specs);
    this.loadState.set('ready');

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
