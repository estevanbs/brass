import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/core/rng.js';

describe('mulberry32', () => {
  it('is reproducible: same seed produces the same sequence', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() stays within [0, 1)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt respects bounds', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('nextInt rejects non-positive bounds', () => {
    const rng = mulberry32(1);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-1)).toThrow(RangeError);
  });

  it('shuffle does not mutate the input and preserves multiset of elements', () => {
    const rng = mulberry32(99);
    const input = [1, 2, 3, 4, 5];
    const copy = input.slice();
    const shuffled = rng.shuffle(input);
    expect(input).toEqual(copy);
    expect(shuffled.slice().sort()).toEqual(copy.slice().sort());
  });

  it('shuffle with the same seed is deterministic', () => {
    const rngA = mulberry32(55);
    const rngB = mulberry32(55);
    const input = Array.from({ length: 10 }, (_, i) => i);
    expect(rngA.shuffle(input)).toEqual(rngB.shuffle(input));
  });

  it('pick throws on empty array', () => {
    const rng = mulberry32(1);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('pick returns an element from the array', () => {
    const rng = mulberry32(3);
    const input = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      expect(input).toContain(rng.pick(input));
    }
  });

  it('getState reflects consumption of the stream', () => {
    const rng = mulberry32(10);
    const s0 = rng.getState();
    rng.next();
    const s1 = rng.getState();
    expect(s1).not.toBe(s0);
  });
});
