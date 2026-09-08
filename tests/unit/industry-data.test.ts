import { describe, expect, it } from 'vitest';
import { INDUSTRY_TYPES } from '../../src/core/types.js';
import {
  INDUSTRY_TILES,
  getIndustryTile,
  initialIndustryStock,
} from '../../src/rules/industry-data.js';

describe('industry-data', () => {
  it('defines exactly 4 levels for each of the 6 industry types', () => {
    for (const industry of INDUSTRY_TYPES) {
      const tiles = INDUSTRY_TILES.filter((t) => t.industry === industry);
      expect(tiles.map((t) => t.level).sort()).toEqual([1, 2, 3, 4]);
    }
  });

  it('cost strictly increases from level 2 to level 4 within each industry (level 1 may be an outlier, e.g. locked pottery)', () => {
    for (const industry of INDUSTRY_TYPES) {
      const byLevel = [2, 3, 4].map((level) => getIndustryTile(industry, level as 2 | 3 | 4));
      for (let i = 1; i < byLevel.length; i++) {
        const prev = byLevel[i - 1];
        const curr = byLevel[i];
        if (prev === undefined || curr === undefined) throw new Error('unreachable');
        expect(curr.cost).toBeGreaterThan(prev.cost);
      }
    }
  });

  it('victory points strictly increase from level 2 to level 4 within each industry (level 1 may be an outlier, e.g. locked pottery)', () => {
    for (const industry of INDUSTRY_TYPES) {
      const byLevel = [2, 3, 4].map((level) => getIndustryTile(industry, level as 2 | 3 | 4));
      for (let i = 1; i < byLevel.length; i++) {
        const prev = byLevel[i - 1];
        const curr = byLevel[i];
        if (prev === undefined || curr === undefined) throw new Error('unreachable');
        expect(curr.victoryPoints).toBeGreaterThan(prev.victoryPoints);
      }
    }
  });

  it('only pottery level 1 is locked', () => {
    const locked = INDUSTRY_TILES.filter((t) => t.locked);
    expect(locked).toHaveLength(1);
    expect(locked[0]).toMatchObject({ industry: 'pottery', level: 1 });
  });

  it('getIndustryTile throws for an unknown combination', () => {
    // @ts-expect-error -- intentionally invalid level to exercise the runtime guard
    expect(() => getIndustryTile('coal', 5)).toThrow();
  });

  it('initialIndustryStock has 8 tiles for every industry except pottery, which has 7', () => {
    for (const industry of INDUSTRY_TYPES) {
      const stock = initialIndustryStock(industry);
      if (industry === 'pottery') {
        expect(stock).toHaveLength(7);
      } else {
        expect(stock).toHaveLength(8);
      }
      expect(stock[0]).toBe(1);
      expect([...stock].sort()).toEqual(stock.slice().sort());
    }
  });

  it('initialIndustryStock has 3/2/2/1 copies of levels 1-4 for non-pottery industries', () => {
    const stock = initialIndustryStock('coal');
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const level of stock) counts[level]++;
    expect(counts).toEqual({ 1: 3, 2: 2, 3: 2, 4: 1 });
  });

  it('initialIndustryStock has 1/2/2/2 copies of levels 1-4 for pottery', () => {
    const stock = initialIndustryStock('pottery');
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const level of stock) counts[level]++;
    expect(counts).toEqual({ 1: 1, 2: 2, 3: 2, 4: 2 });
  });
});
