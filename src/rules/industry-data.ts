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
  /** Cannot be built via the Build action; only removable via Develop. */
  readonly locked: boolean;
}

/** docs/RULES.md §5.3 */
export const INDUSTRY_TILES: readonly IndustryTileDef[] = [
  // Coal mine
  { industry: 'coal', level: 1, cost: 5, coalCost: 0, ironCost: 0, resourceProduced: 2, beerToSell: 0, victoryPoints: 1, incomeGain: 1, locked: false },
  { industry: 'coal', level: 2, cost: 7, coalCost: 0, ironCost: 0, resourceProduced: 3, beerToSell: 0, victoryPoints: 2, incomeGain: 1, locked: false },
  { industry: 'coal', level: 3, cost: 8, coalCost: 0, ironCost: 0, resourceProduced: 4, beerToSell: 0, victoryPoints: 3, incomeGain: 2, locked: false },
  { industry: 'coal', level: 4, cost: 10, coalCost: 0, ironCost: 0, resourceProduced: 5, beerToSell: 0, victoryPoints: 4, incomeGain: 2, locked: false },
  // Iron works
  { industry: 'iron', level: 1, cost: 5, coalCost: 0, ironCost: 0, resourceProduced: 2, beerToSell: 0, victoryPoints: 2, incomeGain: 1, locked: false },
  { industry: 'iron', level: 2, cost: 7, coalCost: 0, ironCost: 0, resourceProduced: 3, beerToSell: 0, victoryPoints: 3, incomeGain: 1, locked: false },
  { industry: 'iron', level: 3, cost: 9, coalCost: 0, ironCost: 0, resourceProduced: 4, beerToSell: 0, victoryPoints: 4, incomeGain: 2, locked: false },
  { industry: 'iron', level: 4, cost: 11, coalCost: 0, ironCost: 0, resourceProduced: 5, beerToSell: 0, victoryPoints: 5, incomeGain: 2, locked: false },
  // Cotton mill
  { industry: 'cotton', level: 1, cost: 12, coalCost: 1, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 5, incomeGain: 1, locked: false },
  { industry: 'cotton', level: 2, cost: 14, coalCost: 1, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 7, incomeGain: 2, locked: false },
  { industry: 'cotton', level: 3, cost: 16, coalCost: 1, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 9, incomeGain: 3, locked: false },
  { industry: 'cotton', level: 4, cost: 18, coalCost: 1, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 12, incomeGain: 4, locked: false },
  // Manufacturer
  { industry: 'manufacturer', level: 1, cost: 8, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 3, incomeGain: 1, locked: false },
  { industry: 'manufacturer', level: 2, cost: 10, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 1, victoryPoints: 5, incomeGain: 2, locked: false },
  { industry: 'manufacturer', level: 3, cost: 12, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 2, victoryPoints: 8, incomeGain: 3, locked: false },
  { industry: 'manufacturer', level: 4, cost: 14, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 2, victoryPoints: 11, incomeGain: 4, locked: false },
  // Pottery (level 1 is locked: build-only-removable-via-develop, see docs/RULES.md §5.4)
  { industry: 'pottery', level: 1, cost: 17, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 1, victoryPoints: 10, incomeGain: 1, locked: true },
  { industry: 'pottery', level: 2, cost: 10, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 1, victoryPoints: 8, incomeGain: 2, locked: false },
  { industry: 'pottery', level: 3, cost: 12, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 1, victoryPoints: 12, incomeGain: 2, locked: false },
  { industry: 'pottery', level: 4, cost: 14, coalCost: 0, ironCost: 1, resourceProduced: 0, beerToSell: 2, victoryPoints: 16, incomeGain: 3, locked: false },
  // Brewery (beer produced on build is era-dependent: 1 in canal, 2 in rail; see engine)
  { industry: 'brewery', level: 1, cost: 5, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 0, victoryPoints: 4, incomeGain: 1, locked: false },
  { industry: 'brewery', level: 2, cost: 7, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 0, victoryPoints: 5, incomeGain: 1, locked: false },
  { industry: 'brewery', level: 3, cost: 9, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 0, victoryPoints: 7, incomeGain: 2, locked: false },
  { industry: 'brewery', level: 4, cost: 11, coalCost: 0, ironCost: 0, resourceProduced: 0, beerToSell: 0, victoryPoints: 8, incomeGain: 2, locked: false },
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

/** docs/RULES.md §5.4: per-player copy counts, lowest level first. */
export function initialIndustryStock(industry: IndustryType): readonly (1 | 2 | 3 | 4)[] {
  if (industry === 'pottery') {
    return [1, 2, 2, 3, 3, 4, 4];
  }
  return [1, 1, 1, 2, 2, 3, 3, 4];
}
