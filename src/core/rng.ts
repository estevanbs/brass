/**
 * Seeded PRNG (mulberry32). Deterministic and cheap — the only source of
 * randomness allowed in production code. `Math.random` is banned by lint.
 */
export interface Rng {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** Fisher-Yates shuffle; returns a new array, does not mutate the input. */
  shuffle<T>(items: readonly T[]): T[];
  /** Picks one element uniformly at random. */
  pick<T>(items: readonly T[]): T;
  /** Current internal state, for serialization. */
  getState(): number;
}

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0 || !Number.isInteger(maxExclusive)) {
      throw new RangeError(`maxExclusive must be a positive integer, got ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  }

  function shuffle<T>(items: readonly T[]): T[] {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = nextInt(i + 1);
      const tmp = result[i] as T;
      result[i] = result[j] as T;
      result[j] = tmp;
    }
    return result;
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError('cannot pick from an empty array');
    }
    return items[nextInt(items.length)] as T;
  }

  function getState(): number {
    return state;
  }

  return { next, nextInt, shuffle, pick, getState };
}
