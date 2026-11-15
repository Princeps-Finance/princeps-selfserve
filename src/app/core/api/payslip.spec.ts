import { sanitizeBanks, bankInitials, bankOption } from './bank-logos';
import { sanitizePayslipFigures } from './payslip';

describe('payslip figures', () => {
  it('keeps clean figures', () => {
    expect(sanitizePayslipFigures({ netMonthly: 185000, grossMonthly: 232500, month: '2026-10', employer: ' Ministry ' })).toEqual({
      netMonthly: 185000, grossMonthly: 232500, month: '2026-10', employer: 'Ministry',
    });
  });

  it('reads amounts written as text with a naira sign and commas', () => {
    expect(sanitizePayslipFigures({ netMonthly: '₦185,000' })?.netMonthly).toBe(185000);
  });

  it('refuses a payslip with no usable take-home pay, or an impossible one', () => {
    expect(sanitizePayslipFigures(null)).toBeNull();
    expect(sanitizePayslipFigures({})).toBeNull();
    expect(sanitizePayslipFigures({ netMonthly: -5 })).toBeNull();
    expect(sanitizePayslipFigures({ netMonthly: 5_000_000_000 })).toBeNull();
  });

  it('drops a gross below the net, and a month that is not YYYY-MM', () => {
    expect(sanitizePayslipFigures({ netMonthly: 200000, grossMonthly: 150000, month: 'October' })).toEqual({ netMonthly: 200000 });
  });
});

describe('bank list from the back end', () => {
  it('keeps a logo only when it is a path on our own site', () => {
    const out = sanitizeBanks([
      { code: '1', name: 'Own', logo: '/banks/1.svg' },
      { code: '2', name: 'Remote', logo: 'https://evil.example/x.png' },
      { code: '3', name: 'Protocol relative', logo: '//evil.example/x.png' },
      { code: '4', name: 'Climb', logo: '/banks/../secret.svg' },
      { code: '5', name: 'Script', logo: 'javascript:alert(1)' },
    ]);
    expect(out.map((b) => b.logo)).toEqual(['/banks/1.svg', undefined, undefined, undefined, undefined]);
  });

  it('drops rows with no code or name, and repeats', () => {
    expect(sanitizeBanks([null, { code: '', name: 'x' }, { code: '1', name: 'A' }, { code: '1', name: 'A again' }])).toEqual([{ code: '1', name: 'A' }]);
  });

  it('gives every bank a mark: its logo, one we ship, or initials', () => {
    expect(bankOption({ code: '044', name: 'Access Bank' }).logo).toBe('/banks/044.svg');
    expect(bankOption({ code: '100004', name: 'Opay Digital Services' })).toMatchObject({ logo: undefined, initials: 'OD' });
    expect(bankOption({ code: '9', name: 'New Bank', logo: '/banks/9.svg' }).logo).toBe('/banks/9.svg');
    expect(bankInitials('Standard Chartered Bank')).toBe('SC');
  });
});
