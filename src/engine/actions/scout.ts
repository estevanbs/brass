import type { GameState } from '../../core/types.js';
import type { ScoutAction } from '../action-types.js';
import { discardCard, updatePlayer } from '../player-ops.js';

export function applyScout(state: GameState, action: ScoutAction): GameState {
  if (state.wildLocationCards < 1 || state.wildIndustryCards < 1) {
    throw new Error('no wild cards left to draw via Scout');
  }
  let working = state;
  for (const card of action.cards) {
    working = discardCard(working, action.player, card);
  }
  working = updatePlayer(working, action.player, (p) => ({
    ...p,
    hand: [...p.hand, { kind: 'wildLocation' }, { kind: 'wildIndustry' }],
  }));
  working = {
    ...working,
    wildLocationCards: working.wildLocationCards - 1,
    wildIndustryCards: working.wildIndustryCards - 1,
  };
  return working;
}
