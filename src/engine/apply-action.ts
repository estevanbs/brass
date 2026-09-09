import type { GameState } from '../core/types.js';
import type { Action } from './action-types.js';
import { applyBuild } from './actions/build.js';
import { applyNetworkAction } from './actions/network-action.js';
import { applyDevelop } from './actions/develop.js';
import { applySell } from './actions/sell.js';
import { applyLoan } from './actions/loan.js';
import { applyScout } from './actions/scout.js';
import { discardCard } from './player-ops.js';

/** Number of actions a player may take on their turn (docs/RULES.md §1, §3). */
export function actionsAllowedThisTurn(state: GameState): number {
  return state.era === 'canal' && state.round === 1 ? 1 : 2;
}

function dispatch(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'build':
      return applyBuild(state, action);
    case 'network':
      return applyNetworkAction(state, action);
    case 'develop':
      return applyDevelop(state, action);
    case 'sell':
      return applySell(state, action);
    case 'loan':
      return applyLoan(state, action);
    case 'scout':
      return applyScout(state, action);
    case 'pass':
      return discardCard(state, action.player, action.card);
  }
}

/**
 * Applies one of the 7 actions to `state`, returning a new state. Never mutates `state`.
 * Throws on any illegal action (docs/RULES.md §4). Does not handle hand refill, turn
 * rotation, or era transitions — see engine/cycle.ts for the full turn/round/era loop.
 */
export function applyAction(state: GameState, action: Action): GameState {
  if (state.gameOver) {
    throw new Error('cannot act after the game has ended');
  }
  const currentPlayer = state.turnOrder[state.activePlayerIndex];
  if (currentPlayer !== action.player) {
    throw new Error(`it is not ${action.player}'s turn (current: ${String(currentPlayer)})`);
  }
  const allowed = actionsAllowedThisTurn(state);
  if (state.actionsTakenThisTurn >= allowed) {
    throw new Error(`${action.player} has already taken all ${allowed} actions this turn`);
  }

  const newState = dispatch(state, action);
  return { ...newState, actionsTakenThisTurn: newState.actionsTakenThisTurn + 1 };
}
