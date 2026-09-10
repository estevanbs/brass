import type { IndustryTileDef, BoardLinkSummary } from './game-view.model';
import type { GameState } from './game-state.model';
import type { IndustryType } from './card.model';

export function findIndustryTile(
  tiles: readonly IndustryTileDef[],
  industry: IndustryType,
  level: 1 | 2 | 3 | 4,
): IndustryTileDef | undefined {
  return tiles.find((t) => t.industry === industry && t.level === level);
}

/**
 * How many VP `link` would score right now if the era ended this instant (docs/RULES.md §9
 * step 1, `src/engine/scoring.ts#scoreLinks` on the backend) — 2 VP per market end it touches,
 * otherwise the VP of every *flipped* industry tile at that end, any owner. The frontend only
 * ever needs this to *display* a live preview on hover; scoring itself always happens
 * server-side at era end. Kept isolated and pure, same rationale as `incomeLevelForPosition`.
 */
export function currentLinkPoints(
  link: BoardLinkSummary,
  state: GameState,
  industryTiles: readonly IndustryTileDef[],
): number {
  const ends = new Set<string>(link.locations);
  for (const [a, b] of link.bonusConnections) {
    ends.add(a);
    ends.add(b);
  }

  let points = 0;
  for (const end of ends) {
    const location = state.locations[end];
    if (location === undefined) continue;
    if (location.kind === 'market') {
      points += 2;
      continue;
    }
    for (const slot of location.slots) {
      const tile = slot.tile;
      if (tile === null || !tile.flipped) continue;
      const def = findIndustryTile(industryTiles, tile.industry, tile.level);
      if (def !== undefined) points += def.victoryPoints;
    }
  }
  return points;
}
