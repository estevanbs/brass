import { describe, expect, it } from 'vitest';
import { incomeLevelForPosition } from './income';

describe('incomeLevelForPosition', () => {
  it('is negative below track position 10', () => {
    expect(incomeLevelForPosition(0)).toBe(-10);
    expect(incomeLevelForPosition(5)).toBe(-5);
  });

  it('is 0 at position 10', () => {
    expect(incomeLevelForPosition(10)).toBe(0);
  });

  it('steps by one level per two positions in the 11-30 band', () => {
    expect(incomeLevelForPosition(11)).toBe(1);
    expect(incomeLevelForPosition(12)).toBe(1);
    expect(incomeLevelForPosition(13)).toBe(2);
  });

  it('steps by one level per three positions in the 31-60 band', () => {
    expect(incomeLevelForPosition(31)).toBe(11);
    expect(incomeLevelForPosition(33)).toBe(11);
    expect(incomeLevelForPosition(34)).toBe(12);
  });

  it('steps by one level per four positions above 60', () => {
    expect(incomeLevelForPosition(61)).toBe(21);
    expect(incomeLevelForPosition(64)).toBe(21);
    expect(incomeLevelForPosition(65)).toBe(22);
  });
});
