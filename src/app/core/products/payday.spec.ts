import { dueDateOf, firstPaydayAfter } from './payday';

describe('payday', () => {
  it('is this month\'s 25th up to the 15th, and next month\'s after that', () => {
    expect(firstPaydayAfter(new Date(2026, 10, 10)).toDateString()).toBe(new Date(2026, 10, 25).toDateString());
    expect(firstPaydayAfter(new Date(2026, 10, 16)).toDateString()).toBe(new Date(2026, 11, 25).toDateString());
  });

  it('puts every repayment on the 25th of its month', () => {
    const first = firstPaydayAfter(new Date(2026, 10, 20));
    expect(dueDateOf(first, 1).toDateString()).toBe(new Date(2026, 11, 25).toDateString());
    expect(dueDateOf(first, 3).toDateString()).toBe(new Date(2027, 1, 25).toDateString());
  });
});
