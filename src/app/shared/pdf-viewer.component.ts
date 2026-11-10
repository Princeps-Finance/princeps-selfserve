import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TPipe } from '../core/i18n/t.pipe';
import { LangService } from '../core/i18n/lang.service';
import { logWarn } from '../core/log';

/** Where the build copies pdf.js's worker and standard fonts (see angular.json). Served from our own site. */
const PDF_ASSETS = '/pdf';
/** Pages are drawn at most this sharp: enough for a phone, and it keeps memory low on cheap devices. */
const MAX_PIXEL_RATIO = 2;

type ViewerState = 'loading' | 'ready' | 'error';

/**
 * Shows a PDF page by page inside the screen, on every phone and browser. The PDF.js library is loaded only when
 * a document is shown. Nothing is sent anywhere: the bytes are drawn locally. A download link is always offered.
 */
@Component({
  selector: 'app-pdf-viewer',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #viewer class="viewer" role="group" [attr.aria-label]="title()" [attr.aria-busy]="state() === 'loading'">
      @if (state() === 'loading') {
        <p class="state" role="status">{{ 'pdf.loading' | t }}</p>
      }
      @if (state() === 'error') {
        <p class="state" role="alert">{{ 'pdf.error' | t }}</p>
      }
      <div #pages class="pages" [hidden]="state() !== 'ready'"></div>
    </div>
    @if (downloadUrl(); as url) {
      <a class="download" [href]="url" download="princeps-offer-letter.pdf">{{ 'pdf.download' | t }}</a>
    }
  `,
  styles: [
    `
      :host { display: block; --pdf-max-height: none; }
      .viewer { background: var(--grey-100); border-radius: var(--radius-md); padding: var(--space-2); max-height: var(--pdf-max-height, 70dvh); overflow: auto; }
      .pages { display: flex; flex-direction: column; gap: var(--space-2); }
      .pages :is(canvas) { width: 100%; height: auto; background: #ffffff; border-radius: var(--radius-xs); box-shadow: var(--shadow-1); }
      .state { margin: 0; padding: var(--space-6) var(--space-4); text-align: center; color: var(--ink-soft); font-size: var(--fs-md); }
      .download { display: inline-flex; align-items: center; min-height: var(--tap-min); margin-top: var(--space-2); color: var(--text-accent); font-weight: var(--fw-medium); text-underline-offset: 3px; }
    `,
  ],
})
export class PdfViewerComponent implements OnDestroy {
  readonly data = input.required<Uint8Array>();
  readonly title = input('PDF');

  private readonly lang = inject(LangService);
  private readonly pagesEl = viewChild.required<ElementRef<HTMLElement>>('pages');
  private readonly viewerEl = viewChild.required<ElementRef<HTMLElement>>('viewer');
  protected readonly state = signal<ViewerState>('loading');
  private readonly url = signal<string | null>(null);
  protected readonly downloadUrl = computed(() => this.url());
  private destroyed = false;
  private task: { destroy(): Promise<void> } | null = null;

  constructor() {
    effect(() => {
      const bytes = this.data();
      // Only a new document should redraw; rendering reads and writes other signals, which must not retrigger it.
      untracked(() => void this.render(bytes));
    });
  }

  private async render(bytes: Uint8Array): Promise<void> {
    this.state.set('loading');
    this.setDownload(bytes);
    try {
      // The legacy build runs on older phones as well; it is only fetched when a document is shown.
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDF_ASSETS}/pdf.worker.min.mjs`;
      // Pass a copy: the worker takes ownership of the bytes it is given.
      const task = pdfjs.getDocument({
        data: bytes.slice(),
        disableFontFace: true,
        standardFontDataUrl: `${PDF_ASSETS}/standard_fonts/`,
      });
      this.task = task;
      const doc = await task.promise;
      const host = this.pagesEl().nativeElement;
      host.replaceChildren();
      // Measure the visible frame, not the hidden page list, so pages are drawn at the width they are shown.
      const width = (this.viewerEl().nativeElement.clientWidth || 320) - 16;
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      for (let n = 1; n <= doc.numPages && !this.destroyed; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `${this.lang.t('pdf.page')} ${n} / ${doc.numPages}`);
        host.appendChild(canvas);
        await page.render({ canvas, viewport }).promise;
      }
      if (!this.destroyed) this.state.set('ready');
    } catch (err) {
      logWarn('pdf could not be shown', err);
      if (!this.destroyed) this.state.set('error');
    }
  }

  private setDownload(bytes: Uint8Array): void {
    const previous = this.url();
    if (previous) URL.revokeObjectURL(previous);
    this.url.set(URL.createObjectURL(new Blob([bytes.slice()], { type: 'application/pdf' })));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    void this.task?.destroy();
    const url = this.url();
    if (url) URL.revokeObjectURL(url);
  }
}
