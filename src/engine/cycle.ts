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
  if (state.actionsTakenThisTurn < allowed) {
    return state;
  }

  const currentPlayer = state.turnOrder[state.activePlayerIndex];
  if (currentPlayer === undefined) throw new Error('unreachable');
  const working = refillHand(state, currentPlayer);

  const nextIndex = state.activePlayerIndex + 1;
  if (nextIndex < state.turnOrder.length) {
    return { ...working, activePlayerIndex: nextIndex, actionsTakenThisTurn: 0 };
  }
  return endOfRound(working);
}
