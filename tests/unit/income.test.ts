import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  advanceIncomeSpaces,
  applyLoanIncomeDrop,
  highestPositionForLevel,
  incomeLevelForPosition,
} from '../../src/engine/income.js';

describe('incomeLevelForPosition', () => {
  it('matches the documented boundary conditions from RULES.md §8', () => {
    expect(incomeLevelForPosition(0)).toBe(-10);
    expect(incomeLevelForPosition(10)).toBe(0);
    expect(incomeLevelForPosition(11)).toBe(1);
    expect(incomeLevelForPosition(30)).toBe(10);
    expect(incomeLevelForPosition(31)).toBe(11);
    expect(incomeLevelForPosition(60)).toBe(20);
    expect(incomeLevelForPosition(61)).toBe(21);
    expect(incomeLevelForPosition(99)).toBe(30);
  });

  it('rejects out-of-range or non-integer positions', () => {
    expect(() => incomeLevelForPosition(-1)).toThrow(RangeError);
    expect(() => incomeLevelForPosition(100)).toThrow(RangeError);
    expect(() => incomeLevelForPosition(1.5)).toThrow(RangeError);
  });

  it('is non-decreasing across the whole track', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 98 }), (p) => {
        expect(incomeLevelForPosition(p + 1)).toBeGreaterThanOrEqual(incomeLevelForPosition(p));
      }),
    );
  });
});

describe('highestPositionForLevel', () => {
  it('is the inverse boundary of incomeLevelForPosition', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10, max: 30 }), (level) => {
        const pos = highestPositionForLevel(level);
        expect(incomeLevelForPosition(pos)).toBe(level);
        if (pos < 99) {
          expect(incomeLevelForPosition(pos + 1)).toBeGreaterThan(level);
        }
      }),
    );
  });

  it('rejects out-of-range levels', () => {
    expect(() => highestPositionForLevel(-11)).toThrow(RangeError);
    expect(() => highestPositionForLevel(31)).toThrow(RangeError);
  });
});

describe('advanceIncomeSpaces', () => {
  it('never exceeds position 99 (income level cap of 30)', () => {
    expect(advanceIncomeSpaces(95, 10)).toBe(99);
    expect(advanceIncomeSpaces(0, 5)).toBe(5);
  });
});

describe('applyLoanIncomeDrop', () => {
  it('drops exactly 3 income levels, landing on the highest space of the new level', () => {
    const startPos = highestPositionForLevel(5);
    const newPos = applyLoanIncomeDrop(startPos);
    expect(incomeLevelForPosition(newPos)).toBe(2);
    expect(newPos).toBe(highestPositionForLevel(2));
  });

  it('throws if the loan would drop the level below -10', () => {
    const startPos = highestPositionForLevel(-9);
    expect(() => applyLoanIncomeDrop(startPos)).toThrow();
  });

  it('succeeds exactly at the -10 floor', () => {
    const startPos = highestPositionForLevel(-7);
    expect(incomeLevelForPosition(applyLoanIncomeDrop(startPos))).toBe(-10);
  });
});
