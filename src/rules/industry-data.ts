import type { IndustryType } from '../core/types.js';

export interface IndustryTileDef {
  readonly industry: IndustryType;
  readonly level: 1 | 2 | 3 | 4;
  readonly cost: number;
  readonly coalCost: number;
  readonly ironCost: number;
  /** Coal/iron units placed on the tile when built (coal mine / iron works only). */
  readonly resourceProduced: number;
  /** Beer barrels required to sell (cotton mill / manufacturer / pottery only). */
  readonly beerToSell: number;
  readonly victoryPoints: number;
  readonly incomeGain: number;
  /** The pottery "lamp icon" tile (docs/HANDBOOK_RULES.md §10): cannot be removed via Develop
   * — the *only* way to clear it is to actually Build it onto the board, even though it's a
   * poor-value tile, so that the better tiles underneath become reachable. */
  readonly locked: boolean;
  /** Level-1 tiles of every industry except pottery carry a canal-era icon
   * (docs/HANDBOOK_RULES.md §6, §13): buildable only during the canal era — once the rail era
   * starts, an unbuilt one can no longer be Built and must be cleared via Develop instead
   * (pottery's level 1 is the documented exception, gated by `locked` above instead). */
  readonly eraRestricted: boolean;
}

/** docs/RULES.md §5.3 */
export const INDUSTRY_TILES: readonly IndustryTileDef[] = [
  // Coal mine
  { industry: 'coal', level: 1, cost: 5, coalCost: 0, ironCost: 0, resourceProduced: 2, beerToSell: 0, victoryPoints: 1, incomeGain: 1, locked: false, eraRestricted: true },
  { industry: 'coal', level: 2, cost: 7, coalCost: 0, ironCost: 0, resourceProduced: 3, beerToSell: 0, victoryPoints: 2, incomeGain: 1, locked: false, eraRestricted: false },
  { industry: 'coal', level: 3, cost: 8, coalCost: 0, ironCost: 0, resourceProduced: 4, beerToSell: 0, victoryPoints: 3, incomeGain: 2, locked: false, eraRestricted: false },
  { industry: 'coal', level: 4, cost: 10, coalCost: 0, ironCost: 0, resourceProduced: 5, beerToSell: 0, victoryPoints: 4, incomeGain: 2, locked: false, eraRestricted: false },
  // Iron works
  { industry: 'iron', level: 1, cost: 5, coalCost: 0, ironCost: 0, resourceProduced: 2, beerToSell: 0, victoryPoints: 2, incomeGain: 1, locked: false, eraRestricted: true },
  { industry: 'iron', level: 2, cost: 7, coalCost: 0, ironCost: 0, resourceProduced: 3, beerToSell: 0, victoryPoints: 3, incomeGain: 1, locked: false, eraRestricted: false },
  { industry: 'iron', level: 3, cost: 9, coalCost: 0, ironCost: 0, resourceProduced: 4, beerToSell: 0, victoryPoints: 4, incomeGain: 2, locked: false, eraRestricted: false },
  { industry: 'iron', level: 4, cost: 11, coalCost: 0, ironCost: 0, resourceProduced: 5, beerToSell: 0, victoryPoints: 5, incomeGain: 2, locked: false, eraRestricted: false },
  // Cotton mill
  { industry: 'cotton', level: 1, cost: 12, coalCost: 1, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 5, incomeGain: 1, locked: false, eraRestricted: true },
  { industry: 'cotton', level: 2, cost: 14, coalCost: 1, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 7, incomeGain: 2, locked: false, eraRestricted: false },
  { industry: 'cotton', level: 3, cost: 16, coalCost: 1, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 9, incomeGain: 3, locked: false, eraRestricted: false },
  { industry: 'cotton', level: 4, cost: 18, coalCost: 1, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 12, incomeGain: 4, locked: false, eraRestricted: false },
  // Manufacturer
  { industry: 'manufacturer', level: 1, cost: 8, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 3, incomeGain: 1, locked: false, eraRestricted: true },
  { industry: 'manufacturer', level: 2, cost: 10, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 1, victoryPoints: 5, incomeGain: 2, locked: false, eraRestricted: false },
  { industry: 'manufacturer', level: 3, cost: 12, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 2, victoryPoints: 8, incomeGain: 3, locked: false, eraRestricted: false },
  { industry: 'manufacturer', level: 4, cost: 14, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 2, victoryPoints: 11, incomeGain: 4, locked: false, eraRestricted: false },
  // Pottery — level 1 is the "lamp icon" tile: buildable in either era, but see `locked` above.
  { industry: 'pottery', level: 1, cost: 17, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 10, incomeGain: 1, locked: true, eraRestricted: false },
  { industry: 'pottery', level: 2, cost: 10, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 1, victoryPoints: 8, incomeGain: 2, locked: false, eraRestricted: false },
  { industry: 'pottery', level: 3, cost: 12, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 1, victoryPoints: 12, incomeGain: 2, locked: false, eraRestricted: false },
  { industry: 'pottery', level: 4, cost: 14, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 2, victoryPoints: 16, incomeGain: 3, locked: false, eraRestricted: false },
  // Brewery (beer produced on build is era-dependent: 1 in canal, 2 in rail; see engine)
  { industry: 'brewery', level: 1, cost: 5, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 0, victoryPoints: 4, incomeGain: 1, locked: false, eraRestricted: true },
  { industry: 'brewery', level: 2, cost: 7, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 0, victoryPoints: 5, incomeGain: 1, locked: false, eraRestricted: false },
  { industry: 'brewery', level: 3, cost: 9, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 0, victoryPoints: 7, incomeGain: 2, locked: false, eraRestricted: false },
  { industry: 'brewery', level: 4, cost: 11, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 0, victoryPoints: 8, incomeGain: 2, locked: false, eraRestricted: false },
];

const TILE_INDEX = new Map<string, IndustryTileDef>(
  INDUSTRY_TILES.map((t) => [`${t.industry}:${t.level}`, t]),
);

export function getIndustryTile(industry: IndustryType, level: 1 | 2 | 3 | 4): IndustryTileDef {
  const tile = TILE_INDEX.get(`${industry}:${level}`);
  if (tile === undefined) {
    throw new Error(`Unknown industry tile: ${industry} level ${level}`);
  }
  return tile;
}

/**
 * Per-player copy counts, lowest level first (docs/RULES.md §5.4). Totals per industry —
 * coal 7, iron 4, cotton 11, manufacturer 11, pottery 5, brewery 7 (45 total) — come directly
 * from docs/HANDBOOK_RULES.md's component list (`180 Indústrias (45 por cor)`, broken down per
 * industry); the exact split *within* each industry across its 4 levels is not given there, so
 * it's this project's own reasonable design (docs/ASSUMPTIONS.md #4), not a transcription.
 */
export function initialIndustryStock(industry: IndustryType): readonly (1 | 2 | 3 | 4)[] {
  switch (industry) {
    case 'iron':
      return [1, 2, 3, 4];
    case 'coal':
    case 'brewery':
      return [1, 1, 2, 2, 3, 3, 4];
    case 'pottery':
      return [1, 2, 2, 3, 4];
    case 'cotton':
    case 'manufacturer':
      return [1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4];
  }
}
