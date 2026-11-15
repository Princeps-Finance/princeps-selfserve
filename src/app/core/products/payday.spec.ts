import { dueDateOf, firstPaydayAfter, isPublicHoliday, paydayOf } from './payday';

const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();

describe('payday', () => {
  it("is this month's 25th up to the 15th, and next month's after that", () => {
    expect(same(firstPaydayAfter(new Date(2026, 10, 10)), new Date(2026, 10, 25))).toBe(true); // Wednesday
    expect(same(firstPaydayAfter(new Date(2026, 9, 16)), new Date(2026, 10, 25))).toBe(true);
  });

  it('moves back to the working day before when the 25th is a weekend', () => {
    expect(same(paydayOf(2026, 5), new Date(2026, 5, 25))).toBe(true); // Thursday
    expect(same(paydayOf(2026, 7), new Date(2026, 7, 25))).toBe(true); // Tuesday
    expect(same(paydayOf(2026, 2), new Date(2026, 2, 25))).toBe(true); // Wednesday
    expect(same(paydayOf(2027, 0), new Date(2027, 0, 25))).toBe(true); // Monday
    expect(same(paydayOf(2026, 5 + 0), new Date(2026, 5, 25))).toBe(true);
    expect(same(paydayOf(2026, 8), new Date(2026, 8, 25))).toBe(true); // Friday
    expect(same(paydayOf(2026, 3), new Date(2026, 3, 24))).toBe(true); // 25 April 2026 is a Saturday
    expect(same(paydayOf(2026, 0), new Date(2026, 0, 23))).toBe(true); // 25 January 2026 is a Sunday
  });

  it('moves back when the 25th is a public holiday', () => {
    expect(same(paydayOf(2026, 11), new Date(2026, 11, 24))).toBe(true); // Christmas Day, a Friday
  });

  it('knows the fixed holidays and the Easter ones', () => {
    expect(isPublicHoliday(new Date(2026, 5, 12))).toBe(true);
    expect(isPublicHoliday(new Date(2026, 3, 3))).toBe(true); // Good Friday 2026
    expect(isPublicHoliday(new Date(2026, 3, 6))).toBe(true); // Easter Monday 2026
    expect(isPublicHoliday(new Date(2026, 5, 15))).toBe(false);
  });

  it('puts every repayment on its month\'s pay date', () => {
    const first = firstPaydayAfter(new Date(2026, 10, 20));
    expect(same(dueDateOf(first, 1), new Date(2026, 11, 24))).toBe(true);
    expect(same(dueDateOf(first, 3), new Date(2027, 1, 25))).toBe(true); // Thursday
  });
});
