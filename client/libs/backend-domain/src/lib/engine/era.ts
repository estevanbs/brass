import type { Card, GameState, LocationState, PlayerId, PlayerState } from '../core/types.js';
import { mulberry32 } from '../core/rng.js';
import { scoreEra } from './scoring.js';

const HAND_SIZE = 8;
const LINK_TILES_PER_ERA = 14;

function removeLevel1Tiles(state: GameState): GameState {
  const newLocations: Record<string, LocationState> = {};
  for (const [id, location] of Object.entries(state.locations)) {
    if (location.kind === 'market') {
      newLocations[id] = location;
      continue;
    }
    const newSlots = location.slots.map((slot) =>
      slot.tile !== null && slot.tile.level === 1 ? { ...slot, tile: null } : slot,
    );
    newLocations[id] = { ...location, slots: newSlots };
  }
  return { ...state, locations: newLocations };
}

function resetMerchantBeer(state: GameState): GameState {
  const newLocations: Record<string, LocationState> = {};
  for (const [id, location] of Object.entries(state.locations)) {
    if (location.kind !== 'market') {
      newLocations[id] = location;
      continue;
    }
    const merchantSlots = location.merchantSlots.map((slot) =>
      slot.icon !== null ? { ...slot, hasBeer: true } : slot,
    );
    newLocations[id] = { ...location, merchantSlots };
  }
  return { ...state, locations: newLocations };
}

function reshuffleAndDeal(state: GameState): GameState {
  const rng = mulberry32(state.rngState);
  const allCards: Card[] = [];
  for (const player of Object.values(state.players)) {
    allCards.push(...player.discardPile);
  }
  const deck = rng.shuffle(allCards);

  const newPlayers: Record<PlayerId, PlayerState> = {};
  let cursor = 0;
  for (const [id, player] of Object.entries(state.players)) {
    const hand = deck.slice(cursor, cursor + HAND_SIZE);
    cursor += HAND_SIZE;
    newPlayers[id] = {
      ...player,
      hand,
      discardPile: [],
      linkTilesRemaining: LINK_TILES_PER_ERA,
    };
  }

  return {
    ...state,
    players: newPlayers,
    drawDeck: deck.slice(cursor),
    rngState: rng.getState(),
  };
}

/**
 * docs/RULES.md §9: scores the era, then either transitions Canal -> Rail (removing level-1
 * tiles, resetting merchant beer, reshuffling discards into a new deck, dealing new hands) or
 * ends the game (Rail era). Caller (engine/cycle.ts) decides when an era has actually ended.
 */
export function endEra(state: GameState): GameState {
  let working = scoreEra(state);

  if (working.era === 'rail') {
    return { ...working, gameOver: true };
  }

  working = removeLevel1Tiles(working);
  working = resetMerchantBeer(working);
  working = reshuffleAndDeal(working);
  return { ...working, era: 'rail', round: 1, activePlayerIndex: 0, actionsTakenThisTurn: 0 };
}
