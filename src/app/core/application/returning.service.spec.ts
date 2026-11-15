import { TestBed } from '@angular/core/testing';
import { ReturningService } from './returning.service';

describe('ReturningService', () => {
  afterEach(() => localStorage.clear());

  it('remembers only the handle, the first name and the masked phone, and forgets on request', () => {
    const s = TestBed.inject(ReturningService);
    s.save({ ref: 'demo-customer-ref-0001', firstName: 'Ada', maskedPhone: '+234 •••• ••78' });
    const stored = localStorage.getItem('princeps.returning') ?? '';
    expect(stored).toContain('Ada');
    expect(stored).not.toMatch(/\d{11}/);
    s.forget();
    expect(s.saved()).toBeNull();
    expect(localStorage.getItem('princeps.returning')).toBeNull();
  });

  it('ignores a stored value that is not a valid handle', () => {
    localStorage.setItem('princeps.returning', JSON.stringify({ ref: '12345678901', firstName: 'Ada', maskedPhone: 'x' }));
    TestBed.resetTestingModule();
    expect(TestBed.inject(ReturningService).saved()).toBeNull();
  });
});
