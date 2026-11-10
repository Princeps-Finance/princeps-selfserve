import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { API_CLIENT, OfferLetterRequest } from '../../../core/api/api-client';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ModalComponent } from '../../../shared/modal.component';
import { PdfViewerComponent } from '../../../shared/pdf-viewer.component';

/**
 * The customer's offer letter. A short card with a button; the letter itself opens in a modal and is only
 * fetched the first time it is opened.
 */
@Component({
  selector: 'app-offer-letter',
  imports: [TPipe, ModalComponent, PdfViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="letter" aria-labelledby="letter-title">
      <span class="icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></svg>
      </span>
      <div class="text">
        <h2 id="letter-title" class="letter-title">{{ 'pdf.letter.title' | t }}</h2>
        <p class="note">{{ 'pdf.letter.hint' | t }}</p>
      </div>
      <button type="button" class="alt read" (click)="show()">{{ 'pdf.letter.read' | t }}</button>
    </section>

    <app-modal [open]="open()" [title]="'pdf.letter.title' | t" (closed)="open.set(false)">
      @if (bytes(); as data) {
        <app-pdf-viewer [data]="data" [title]="'pdf.letter.title' | t" />
      } @else if (failed()) {
        <p class="note" role="alert">{{ 'pdf.letter.error' | t }}</p>
        <button type="button" class="alt" (click)="load()">{{ 'common.retry' | t }}</button>
      } @else {
        <p class="note" role="status">{{ 'pdf.loading' | t }}</p>
      }
    </app-modal>
  `,
  styles: [
    `
      .letter { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius-md); background: var(--grey-100); }
      .icon { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--action-primary-soft); color: var(--text-accent); }
      .text { flex: 1; min-width: 0; }
      .letter-title { margin: 0; font-family: var(--font-display); font-size: var(--fs-lg); font-weight: 600; }
      .note { margin: 2px 0 0; color: var(--ink-soft); font-size: var(--fs-sm); line-height: 1.4; }
      .read { flex: none; align-self: auto; padding: 0 var(--space-4); background: var(--surface-0); }
    `,
  ],
})
export class OfferLetterComponent {
  readonly request = input.required<OfferLetterRequest>();
  private readonly api = inject(API_CLIENT);
  protected readonly open = signal(false);
  protected readonly bytes = signal<Uint8Array | null>(null);
  protected readonly failed = signal(false);

  protected show(): void {
    this.open.set(true);
    if (!this.bytes()) void this.load();
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
