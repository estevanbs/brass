import type { GameState, PlayerId } from '../../core/types.js';
import type { LoanAction, PassAction, ScoutAction } from '../action-types.js';
import { distinctCards } from '../cards.js';

export function generateLoanActions(state: GameState, playerId: PlayerId): LoanAction[] {
  const player = state.players[playerId];
  if (player === undefined) return [];
  return distinctCards(player.hand).map((card) => ({ type: 'loan', player: playerId, card }));
}

export function generatePassActions(state: GameState, playerId: PlayerId): PassAction[] {
  const player = state.players[playerId];
  if (player === undefined) return [];
  return distinctCards(player.hand).map((card) => ({ type: 'pass', player: playerId, card }));
}

/** Combinations of 3 distinct-by-value cards from the hand — repeated copies of the same
 * card collapse (docs/PLANO.md M4), but distinct card values remain genuine choices about
 * which cards to give up (docs/ASSUMPTIONS.md #11). */
export function generateScoutActions(state: GameState, playerId: PlayerId): ScoutAction[] {
  const player = state.players[playerId];
  if (player === undefined || state.wildLocationCards < 1 || state.wildIndustryCards < 1) return [];
  const unique = distinctCards(player.hand);
  if (unique.length < 3) return [];

  const actions: ScoutAction[] = [];
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      for (let k = j + 1; k < unique.length; k++) {
        const a = unique[i];
        const b = unique[j];
        const c = unique[k];
        if (a === undefined || b === undefined || c === undefined) continue;
        actions.push({ type: 'scout', player: playerId, cards: [a, b, c] });
      }
    }
  }
  return actions;
}
