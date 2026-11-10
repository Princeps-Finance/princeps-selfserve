import { ChangeDetectionStrategy, Component, inject, input, output, signal, type OnInit } from '@angular/core';
import { API_CLIENT, OfferLetterRequest } from '../../../core/api/api-client';
import { TPipe } from '../../../core/i18n/t.pipe';
import { PdfViewerComponent } from '../../../shared/pdf-viewer.component';

/**
 * The customer's offer letter, shown in the page and fetched as soon as the screen opens. `readToEnd` fires when
 * the customer has scrolled to the bottom, which is what unlocks the agreement box below it.
 */
@Component({
  selector: 'app-offer-letter',
  imports: [TPipe, PdfViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="letter" aria-labelledby="letter-title">
      <h2 id="letter-title" class="letter-title">{{ 'pdf.letter.title' | t }}</h2>
      <p class="note">{{ 'step.terms.letter.scroll' | t }}</p>
      @if (bytes(); as data) {
        <app-pdf-viewer [data]="data" [title]="'pdf.letter.title' | t" (readToEnd)="readToEnd.emit()" />
      } @else if (failed()) {
        <p class="note" role="alert">{{ 'pdf.letter.error' | t }}</p>
        <button type="button" class="alt" (click)="load()">{{ 'common.retry' | t }}</button>
      } @else {
        <p class="note" role="status">{{ 'pdf.loading' | t }}</p>
      }
    </section>
  `,
  styles: [
    `
      .letter { display: flex; flex-direction: column; gap: var(--space-2); }
      .letter-title { margin: 0; font-family: var(--font-display); font-size: var(--fs-base); font-weight: 700; letter-spacing: -0.01em; }
      .note { margin: 0; color: var(--ink-soft); font-size: var(--fs-sm); line-height: 1.4; }
      app-pdf-viewer { --pdf-max-height: 62dvh; }
    `,
  ],
})
export class OfferLetterComponent implements OnInit {
  readonly request = input.required<OfferLetterRequest>();
  readonly readToEnd = output<void>();
  private readonly api = inject(API_CLIENT);
  protected readonly bytes = signal<Uint8Array | null>(null);
  protected readonly failed = signal(false);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.failed.set(false);
    try {
      this.bytes.set(await this.api.getOfferLetter(this.request()));
    } catch {
      this.failed.set(true);
    }
  }
}
