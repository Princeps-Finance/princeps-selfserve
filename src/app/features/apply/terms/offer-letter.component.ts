import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { API_CLIENT, OfferLetterRequest } from '../../../core/api/api-client';
import { TPipe } from '../../../core/i18n/t.pipe';
import { PdfViewerComponent } from '../../../shared/pdf-viewer.component';

/** The customer's offer letter, fetched for the offer they are about to accept and shown as a PDF. */
@Component({
  selector: 'app-offer-letter',
  imports: [TPipe, PdfViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="letter" aria-labelledby="letter-title">
      <h2 id="letter-title" class="letter-title">{{ 'pdf.letter.title' | t }}</h2>
      @if (bytes(); as data) {
        <app-pdf-viewer [data]="data" [title]="'pdf.letter.title' | t" />
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
      .letter { display: flex; flex-direction: column; gap: var(--space-3); }
      .letter-title { margin: 0; font-family: var(--font-display); font-size: var(--fs-lg); font-weight: 600; }
      .note { margin: 0; color: var(--ink-soft); font-size: var(--fs-md); }
    `,
  ],
})
export class OfferLetterComponent implements OnInit {
  readonly request = input.required<OfferLetterRequest>();
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
