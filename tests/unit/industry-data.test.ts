import { describe, expect, it } from 'vitest';
import { INDUSTRY_TYPES } from '../../src/core/types.js';
import {
  INDUSTRY_TILES,
  getIndustryTile,
  initialIndustryStock,
} from '../../src/rules/industry-data.js';

const STOCK_TOTAL_BY_INDUSTRY: Readonly<Record<string, number>> = {
  coal: 7,
  iron: 4,
  cotton: 11,
  manufacturer: 11,
  pottery: 5,
  brewery: 7,
};

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

  it('only pottery level 1 is locked (removable only via Build, never Develop)', () => {
    const locked = INDUSTRY_TILES.filter((t) => t.locked);
    expect(locked).toHaveLength(1);
    expect(locked[0]).toMatchObject({ industry: 'pottery', level: 1 });
  });

  it('level 1 of every industry except pottery is era-restricted (canal-only)', () => {
    const eraRestricted = INDUSTRY_TILES.filter((t) => t.eraRestricted);
    expect(eraRestricted.map((t) => `${t.industry}:${t.level}`).sort()).toEqual(
      ['brewery:1', 'coal:1', 'cotton:1', 'iron:1', 'manufacturer:1'].sort(),
    );
  });

  it('getIndustryTile throws for an unknown combination', () => {
    // @ts-expect-error -- intentionally invalid level to exercise the runtime guard
    expect(() => getIndustryTile('coal', 5)).toThrow();
  });

  it('initialIndustryStock totals match docs/HANDBOOK_RULES.md\'s per-industry component counts (45 per player)', () => {
    let total = 0;
    for (const industry of INDUSTRY_TYPES) {
      const stock = initialIndustryStock(industry);
      expect(stock).toHaveLength(STOCK_TOTAL_BY_INDUSTRY[industry]!);
      expect(stock[0]).toBe(1);
      expect([...stock].sort()).toEqual(stock.slice().sort());
      total += stock.length;
    }
    expect(total).toBe(45);
  });

  it('initialIndustryStock gives iron exactly 1 copy of each level', () => {
    const stock = initialIndustryStock('iron');
    expect(stock).toEqual([1, 2, 3, 4]);
  });

  it('initialIndustryStock gives pottery a single (locked) level-1 copy', () => {
    const stock = initialIndustryStock('pottery');
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const level of stock) counts[level]++;
    expect(counts[1]).toBe(1);
  });
});
