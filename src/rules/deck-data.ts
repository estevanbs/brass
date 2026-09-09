import { INDUSTRY_TYPES, type Card } from '../core/types.js';
import { INDUSTRIAL_LOCATIONS } from './board-data.js';

/** docs/RULES.md §10: copies of each card by player count (index 0 = 2p, 1 = 3p, 2 = 4p). */
const LOCATION_CARD_COPIES: readonly [number, number, number] = [1, 2, 3];
const INDUSTRY_CARD_COPIES: readonly [number, number, number] = [2, 3, 4];

function copiesForPlayerCount(schedule: readonly [number, number, number], playerCount: number): number {
  if (playerCount < 2 || playerCount > 4) {
    throw new RangeError(`playerCount must be 2-4, got ${playerCount}`);
  }
  const copies = schedule[playerCount - 2];
  if (copies === undefined) {
    throw new RangeError(`no copy count defined for playerCount ${playerCount}`);
  }
  return copies;
}

/** Unshuffled draw deck (excludes wild cards, which live in separate always-visible piles). */
export function buildDrawDeck(playerCount: number): Card[] {
  const deck: Card[] = [];
  const locationCopies = copiesForPlayerCount(LOCATION_CARD_COPIES, playerCount);
  for (const location of INDUSTRIAL_LOCATIONS) {
    // docs/HANDBOOK_RULES.md §2 "Estandartes de Local": below a location's own banner-color
    // threshold, its card is left out of the deck entirely — the location stays on the board
    // and buildable via an industry card or wildcard, it just can't be drawn by name.
    if (playerCount < location.deckMinPlayers) continue;
    for (let i = 0; i < locationCopies; i++) {
      deck.push({ kind: 'location', locationId: location.id });
    }
  }
  const industryCopies = copiesForPlayerCount(INDUSTRY_CARD_COPIES, playerCount);
  for (const industry of INDUSTRY_TYPES) {
    for (let i = 0; i < industryCopies; i++) {
      deck.push({ kind: 'industry', industry });
    }
  }
  return deck;
}
