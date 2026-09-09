import type { GameState } from '../../core/types.js';
import type { DevelopAction } from '../action-types.js';
import { discardCard, payMoney, removeLowestStockTile } from '../player-ops.js';
import { applyFlip, consumeIron, validateIronSource } from '../resources.js';

export function applyDevelop(state: GameState, action: DevelopAction): GameState {
  if (action.ironSources.length !== action.industries.length) {
    throw new Error(
      `develop requires exactly 1 iron source per tile removed (${action.industries.length} tiles, ${action.ironSources.length} sources)`,
    );
  }

  let working = state;
  let totalCost = 0;

  for (let i = 0; i < action.industries.length; i++) {
    const industry = action.industries[i];
    const ironSource = action.ironSources[i];
    if (industry === undefined || ironSource === undefined) {
      throw new Error('unreachable');
    }
    validateIronSource(working, ironSource);
    const result = consumeIron(working, ironSource);
    working = applyFlip(result.state, result.flipped);
    totalCost += result.cost;
    working = removeLowestStockTile(working, action.player, industry).state;
  }

  working = payMoney(working, action.player, totalCost);
  working = discardCard(working, action.player, action.card);
  return working;
}
