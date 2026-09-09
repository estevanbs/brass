import type { GameState } from '../core/types.js';
import { LINK_SLOTS } from '../rules/board-data.js';
import { getIndustryTile } from '../rules/industry-data.js';
import { addVictoryPoints } from './player-ops.js';

const LINK_SLOT_BY_ID = new Map(LINK_SLOTS.map((l) => [l.id, l]));

function linkEnds(slotId: string): Set<string> {
  const def = LINK_SLOT_BY_ID.get(slotId);
  if (def === undefined) {
    throw new Error(`unknown link slot: ${slotId}`);
  }
  const ends = new Set<string>(def.locations);
  for (const [a, b] of def.bonusConnections) {
    ends.add(a);
    ends.add(b);
  }
  return ends;
}

/** docs/RULES.md §9 step 1: score each link tile (2 VP per market end, otherwise the VP of
 * every flipped industry tile at that location, any owner), then clear all links. */
export function scoreLinks(state: GameState): GameState {
  let working = state;
  for (const link of state.links) {
    let points = 0;
    for (const end of linkEnds(link.slotId)) {
      const location = state.locations[end];
      if (location === undefined) continue;
      if (location.kind === 'market') {
        points += 2;
        continue;
      }
      for (const slot of location.slots) {
        const tile = slot.tile;
        if (tile !== null && tile.flipped) {
          points += getIndustryTile(tile.industry, tile.level).victoryPoints;
        }
      }
    }
    working = addVictoryPoints(working, link.owner, points);
  }
  return { ...working, links: [] };
}

/** docs/RULES.md §9 step 2: every flipped industry tile scores its owner its VP value. */
export function scoreIndustries(state: GameState): GameState {
  let working = state;
  for (const location of Object.values(state.locations)) {
    for (const slot of location.slots) {
      const tile = slot.tile;
      if (tile !== null && tile.flipped) {
        working = addVictoryPoints(working, tile.owner, getIndustryTile(tile.industry, tile.level).victoryPoints);
      }
    }
  }
  return working;
}

/** Full end-of-era scoring: links (then removed), then industries. */
export function scoreEra(state: GameState): GameState {
  return scoreIndustries(scoreLinks(state));
}
