import type { GameState, PlayerId } from '../core/types.js';
import { actionsAllowedThisTurn } from './apply-action.js';
import { endEra } from './era.js';
import { incomeLevelForPosition } from './income.js';
import { addVictoryPoints, getPlayerOrThrow, updatePlayer } from './player-ops.js';
import { getIndustryTile } from '../rules/industry-data.js';

const HAND_SIZE = 8;

function refillHand(state: GameState, playerId: PlayerId): GameState {
  const player = getPlayerOrThrow(state, playerId);
  const need = HAND_SIZE - player.hand.length;
  if (need <= 0 || state.drawDeck.length === 0) return state;
  const draw = Math.min(need, state.drawDeck.length);
  const newHand = [...player.hand, ...state.drawDeck.slice(0, draw)];
  const newDeck = state.drawDeck.slice(draw);
  return updatePlayer({ ...state, drawDeck: newDeck }, playerId, (p) => ({ ...p, hand: newHand }));
}

/** docs/RULES.md §3b: sell off industry tiles (half cost, rounded down, cheapest first) to
 * cover a negative-income shortfall; whatever remains costs 1 VP per £1. */
function coverShortfallWithTiles(state: GameState, playerId: PlayerId, shortfall: number): GameState {
  const candidates: { locationId: string; slotIndex: number; cost: number }[] = [];
  for (const location of Object.values(state.locations)) {
    if (location.kind === 'market') continue;
    location.slots.forEach((slot, slotIndex) => {
      if (slot.tile !== null && slot.tile.owner === playerId) {
        candidates.push({
          locationId: location.id,
          slotIndex,
          cost: getIndustryTile(slot.tile.industry, slot.tile.level).cost,
        });
      }
    });
  }
  candidates.sort((a, b) => a.cost - b.cost);

  let working = state;
  let remaining = shortfall;
  for (const candidate of candidates) {
    if (remaining <= 0) break;
    const location = working.locations[candidate.locationId];
    if (location === undefined) throw new Error('unreachable');
    const slot = location.slots[candidate.slotIndex];
    if (slot === undefined) throw new Error('unreachable');
    const newSlots = location.slots.slice();
    newSlots[candidate.slotIndex] = { ...slot, tile: null };
    working = {
      ...working,
      locations: { ...working.locations, [candidate.locationId]: { ...location, slots: newSlots } },
    };
    const refund = Math.floor(candidate.cost / 2);
    remaining -= refund;
  }
  if (remaining < 0) {
    working = updatePlayer(working, playerId, (p) => ({ ...p, money: p.money - remaining }));
    remaining = 0;
  }
  if (remaining > 0) {
    working = addVictoryPoints(working, playerId, -remaining);
  }
  return working;
}

function payIncomeToAll(state: GameState): GameState {
  let working = state;
  for (const id of Object.keys(state.players)) {
    const player = getPlayerOrThrow(working, id);
    const level = incomeLevelForPosition(player.incomeTrackPosition);
    if (level >= 0) {
      working = updatePlayer(working, id, (p) => ({ ...p, money: p.money + level }));
      continue;
    }
    working = updatePlayer(working, id, (p) => ({ ...p, money: p.money + level }));
    const afterPayment = getPlayerOrThrow(working, id);
    if (afterPayment.money < 0) {
      const shortfall = -afterPayment.money;
      working = updatePlayer(working, id, (p) => ({ ...p, money: 0 }));
      working = coverShortfallWithTiles(working, id, shortfall);
    }
  }
  return working;
}

function endOfRound(state: GameState): GameState {
  const withSpending = state.turnOrder.map((id, index) => ({
    id,
    spent: getPlayerOrThrow(state, id).spentThisRound,
    index,
  }));
  withSpending.sort((a, b) => a.spent - b.spent || a.index - b.index);
  const newTurnOrder = withSpending.map((entry) => entry.id);

  let working: GameState = { ...state, turnOrder: newTurnOrder };
  for (const id of newTurnOrder) {
    working = updatePlayer(working, id, (p) => ({ ...p, spentThisRound: 0 }));
  }

  const eraEnding =
    working.drawDeck.length === 0 && Object.values(working.players).every((p) => p.hand.length === 0);

  if (eraEnding) {
    if (working.era === 'rail') {
      return endEra(working);
    }
    working = payIncomeToAll(working);
    return endEra(working);
  }

  working = payIncomeToAll(working);
  return { ...working, round: working.round + 1, activePlayerIndex: 0, actionsTakenThisTurn: 0 };
}

/**
 * Call after every applyAction: handles per-turn hand refill, turn rotation, and — once a
 * full round completes — end-of-round income/reordering and era transitions. A no-op while
 * the active player still has actions left this turn.
 */
export function advanceAfterAction(state: GameState): GameState {
  if (state.gameOver) return state;

  const allowed = actionsAllowedThisTurn(state);
  const currentPlayer = state.turnOrder[state.activePlayerIndex];
  if (currentPlayer === undefined) throw new Error('unreachable');

  if (state.actionsTakenThisTurn < allowed) {
    // A turn with actions left can still be stuck if the hand ran out mid-turn (every action
    // needs a card to discard) — in that case, treat the remaining actions as forfeited.
    if (getPlayerOrThrow(state, currentPlayer).hand.length > 0) {
      return state;
    }
    return advanceAfterAction({ ...state, actionsTakenThisTurn: allowed });
  }

  const working = refillHand(state, currentPlayer);

  const nextIndex = state.activePlayerIndex + 1;
  if (nextIndex < state.turnOrder.length) {
    return skipEmptyHandTurns({ ...working, activePlayerIndex: nextIndex, actionsTakenThisTurn: 0 });
  }
  return skipEmptyHandTurns(endOfRound(working));
}

/**
 * Every action requires discarding at least 1 card, so a player whose hand is empty (which
 * can happen a little before the draw deck and every hand empty simultaneously — our card
 * counts are an original approximation, docs/ASSUMPTIONS.md #6, #12) cannot act at all.
 * Their turn is skipped with no effect, as if they had silently taken their full allotment of
 * actions, until either they have cards again (next era) or the era itself ends.
 */
export function skipEmptyHandTurns(state: GameState): GameState {
  let working = state;
  while (!working.gameOver) {
    const activeId = working.turnOrder[working.activePlayerIndex];
    if (activeId === undefined) return working;
    const player = getPlayerOrThrow(working, activeId);
    if (player.hand.length > 0) return working;
    working = advanceAfterAction({ ...working, actionsTakenThisTurn: actionsAllowedThisTurn(working) });
  }
  return working;
}
