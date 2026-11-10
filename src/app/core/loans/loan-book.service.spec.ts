import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { API_CLIENT, LoanSummary } from '../api/api-client';
import { ApplicationStateService } from '../application/application-state.service';
import { FlowNavigator } from '../flow/flow-navigator.service';
import { LoanBookService } from './loan-book.service';

const loan = (over: Partial<LoanSummary>): LoanSummary => ({
  id: 'a', reference: 'R', productName: 'P', status: 'active', principal: 100, outstanding: 50, monthlyRepayment: 10,
  nextDueDate: '2026-12-25', instalmentsPaid: 1, instalmentsTotal: 5, ratePercent: 5, disbursedAt: '2026-01-01', mandateActive: true,
  ...over,
});

function setup(listLoans: () => Promise<LoanSummary[]>) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: API_CLIENT, useValue: { listLoans } }, { provide: FlowNavigator, useValue: { go: async () => true } }] });
  return { book: TestBed.inject(LoanBookService), state: TestBed.inject(ApplicationStateService) };
}

describe('LoanBookService', () => {
  it('lists overdue loans first and keeps paid-off ones separate', async () => {
    const { book } = setup(async () => [loan({ id: 'ok' }), loan({ id: 'late', status: 'overdue' }), loan({ id: 'done', status: 'completed' })]);
    await book.load();
    expect(book.open().map((l) => l.id)).toEqual(['late', 'ok']);
    expect(book.completed().map((l) => l.id)).toEqual(['done']);
    expect(book.byId('late')?.status).toBe('overdue');
  });

  it('reports an error instead of an empty list when Caltos cannot be reached', async () => {
    const { book } = setup(async () => {
      throw new Error('down');
    });
    await book.load();
    expect(book.status()).toBe('error');
    expect(book.loans()).toEqual([]);
  });

  it('remembers the employment type when starting a new loan', async () => {
    const { book, state } = setup(async () => []);
    state.setReturningCustomer(true, {
      fullName: 'Ada Obi', lastLoanAt: '2026-03-14', employmentType: 'government', employerName: 'X', bankName: 'Y', accountLast4: '1234', monthlyIncome: 1,
    });
    await book.startNewLoan();
    expect(state.employment()?.type).toBe('government');
  });
});
