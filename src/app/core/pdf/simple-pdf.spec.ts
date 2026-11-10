import { describe, expect, it } from 'vitest';
import { buildSimplePdf } from './simple-pdf';

describe('buildSimplePdf', () => {
  const text = (b: Uint8Array) => new TextDecoder().decode(b);

  it('starts and ends like a PDF', () => {
    const pdf = text(buildSimplePdf('Offer', ['Amount: NGN 200,000']));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('writes each line and keeps parentheses from breaking the text', () => {
    const pdf = text(buildSimplePdf('Offer (draft)', ['Repay (monthly): NGN 35,000']));
    expect(pdf).toContain('Offer \\(draft\\)');
    expect(pdf).toContain('Repay \\(monthly\\): NGN 35,000');
  });

  it('records the byte offset of the xref table so readers can find it', () => {
    const pdf = text(buildSimplePdf('Offer', ['x']));
    const start = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(start, start + 4)).toBe('xref');
  });
});
