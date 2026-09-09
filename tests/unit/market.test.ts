import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  COAL_MARKET_CAPACITY,
  IRON_MARKET_CAPACITY,
  buyCoal,
  buyIron,
  sellCoalToMarket,
  sellIronToMarket,
} from '../../src/engine/market.js';

describe('coal market', () => {
  it('costs £8 when empty and £1 when full, per RULES.md §7.1', () => {
    expect(buyCoal(0).cost).toBe(8);
    expect(buyCoal(14).cost).toBe(1);
  });

  it('matches the setup price: 13 cubes present costs £1 for the first purchase', () => {
    expect(buyCoal(13).cost).toBe(1);
  });

  it('buying decrements cubes by 1, never below 0', () => {
    expect(buyCoal(1).newCubes).toBe(0);
    expect(buyCoal(0).newCubes).toBe(0);
  });

  it('selling never exceeds capacity and reports unsold overflow', () => {
    const result = sellCoalToMarket(COAL_MARKET_CAPACITY - 2, 5);
    expect(result.newCubes).toBe(COAL_MARKET_CAPACITY);
    expect(result.unsold).toBe(3);
    expect(result.revenue).toBeGreaterThan(0);
  });

  it('price is monotonically non-increasing as cubes present increases', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: COAL_MARKET_CAPACITY - 1 }), (cubes) => {
        expect(buyCoal(cubes + 1).cost).toBeLessThanOrEqual(buyCoal(cubes).cost);
      }),
    );
  });
});

describe('iron market', () => {
  it('costs £6 when empty and £1 when full, per RULES.md §7.2', () => {
    expect(buyIron(0).cost).toBe(6);
    expect(buyIron(10).cost).toBe(1);
  });

  it('matches the setup price: 8 cubes present costs £2 for the first purchase', () => {
    expect(buyIron(8).cost).toBe(2);
  });

  it('selling never exceeds capacity and reports unsold overflow', () => {
    const result = sellIronToMarket(IRON_MARKET_CAPACITY - 1, 4);
    expect(result.newCubes).toBe(IRON_MARKET_CAPACITY);
    expect(result.unsold).toBe(3);
  });

  it('price is monotonically non-increasing as cubes present increases', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: IRON_MARKET_CAPACITY - 1 }), (cubes) => {
        expect(buyIron(cubes + 1).cost).toBeLessThanOrEqual(buyIron(cubes).cost);
      }),
    );
  });
});
