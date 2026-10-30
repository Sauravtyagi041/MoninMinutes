import { describe, expect, it } from 'vitest';
import { resolveDueDate } from '../src/services/ai/dates.js';

const wed = new Date('2026-10-28T12:00:00Z'); // Wednesday

describe('resolveDueDate', () => {
  it('resolves weekdays relative to the meeting date, not today', () => {
    expect(resolveDueDate('by Friday', wed)).toBe('2026-10-30');
    expect(resolveDueDate('Wednesday', wed)).toBe('2026-11-04');
    expect(resolveDueDate('Monday EOD', wed)).toBe('2026-11-02');
  });
  it('resolves tomorrow / today', () => {
    expect(resolveDueDate('tomorrow', wed)).toBe('2026-10-29');
    expect(resolveDueDate('end of day', wed)).toBe('2026-10-28');
  });
  it('resolves month-day forms and rolls over the year when already past', () => {
    expect(resolveDueDate('Nov 5', wed)).toBe('2026-11-05');
    expect(resolveDueDate('5th of November', wed)).toBe('2026-11-05');
    expect(resolveDueDate('Jan 10', wed)).toBe('2027-01-10');
    expect(resolveDueDate('November 5, 2027', wed)).toBe('2027-11-05');
    expect(resolveDueDate('2026-12-01', wed)).toBe('2026-12-01');
  });
  it('stays null for missing, vague or ambiguous deadlines', () => {
    expect(resolveDueDate(null, wed)).toBeNull();
    expect(resolveDueDate('', wed)).toBeNull();
    expect(resolveDueDate('end of sprint', wed)).toBeNull();
    expect(resolveDueDate('next Friday', wed)).toBeNull();
    expect(resolveDueDate('Friday or Monday', wed)).toBeNull();
    expect(resolveDueDate('Feb 30', wed)).toBeNull();
    expect(resolveDueDate('soon', wed)).toBeNull();
  });
});
