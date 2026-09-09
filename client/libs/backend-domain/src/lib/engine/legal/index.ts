import { canonicalize } from '../../core/state.js';
import type { GameState, PlayerId } from '../../core/types.js';
import type { Action } from '../action-types.js';
import { applyBuild } from '../actions/build.js';
import { applyDevelop } from '../actions/develop.js';
import { applyLoan } from '../actions/loan.js';
import { applyNetworkAction } from '../actions/network-action.js';
import { applyScout } from '../actions/scout.js';
import { applySell } from '../actions/sell.js';
import { generateBuildActions } from './build.js';
import { generateDevelopActions } from './develop.js';
import { generateLoanActions, generatePassActions, generateScoutActions } from './misc.js';
import { generateNetworkActions } from './network.js';
import { generateSellActions } from './sell.js';

function isApplicable(state: GameState, action: Action): boolean {
  try {
    switch (action.type) {
      case 'build':
        applyBuild(state, action);
        return true;
      case 'network':
        applyNetworkAction(state, action);
        return true;
      case 'develop':
        applyDevelop(state, action);
        return true;
      case 'sell':
        applySell(state, action);
        return true;
      case 'loan':
        applyLoan(state, action);
        return true;
      case 'scout':
        applyScout(state, action);
        return true;
      case 'pass':
        return true;
    }
  } catch {
    return false;
  }
}

/**
 * All legal actions for `playerId` in `state`, canonical and deduplicated (docs/PLANO.md M4).
 * Generators over-produce plausible candidates; every one is verified here by actually
 * applying it with the real (already fully-tested) action code, so a candidate never reaches
 * the caller unless it is truly applicable without error.
 */
export function legalActions(state: GameState, playerId: PlayerId): Action[] {
  const candidates: Action[] = [
    ...generateBuildActions(state, playerId),
    ...generateNetworkActions(state, playerId),
    ...generateDevelopActions(state, playerId),
    ...generateSellActions(state, playerId),
    ...generateLoanActions(state, playerId),
    ...generateScoutActions(state, playerId),
    ...generatePassActions(state, playerId),
  ];

  const seen = new Set<string>();
  const result: Action[] = [];
  for (const action of candidates) {
    if (!isApplicable(state, action)) continue;
    const key = JSON.stringify(canonicalize(action));
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result;
}
