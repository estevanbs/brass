import { INDUSTRY_TYPES, type Card, type IndustryType } from '../core/types.js';
import { INDUSTRIAL_LOCATIONS } from './board-data.js';

/** Copies of each industry card in the draw deck at [2, 3, 4] players — read directly off the
 * game's own printed "Distribuição de Cartas" reference card (docs/ASSUMPTIONS.md #22), which
 * replaced an earlier, uniform-across-industries guess (every industry got the same count).
 * Real counts vary a lot by industry: iron and brewery never change with player count, while
 * cotton/manufacturer are entirely absent from the 2-player deck. */
const INDUSTRY_CARD_COPIES: Readonly<Record<IndustryType, readonly [number, number, number]>> = {
  coal: [2, 2, 3],
  iron: [4, 4, 4],
  cotton: [0, 6, 8],
  manufacturer: [0, 6, 8],
  pottery: [2, 2, 3],
  brewery: [5, 5, 5],
};

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
  for (const location of INDUSTRIAL_LOCATIONS) {
    const copies = copiesForPlayerCount(location.deckCopies, playerCount);
    for (let i = 0; i < copies; i++) {
      deck.push({ kind: 'location', locationId: location.id });
    }
  }
  for (const industry of INDUSTRY_TYPES) {
    const copies = copiesForPlayerCount(INDUSTRY_CARD_COPIES[industry], playerCount);
    for (let i = 0; i < copies; i++) {
      deck.push({ kind: 'industry', industry });
    }
  }
  return deck;
}
