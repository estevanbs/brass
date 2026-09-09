import type { GameState, PlayerId } from '../core/types.js';
import { INDUSTRY_TYPES } from '../core/types.js';
import { applyAction } from '../engine/apply-action.js';
import { incomeLevelForPosition } from '../engine/income.js';
import { legalActions } from '../engine/legal/index.js';
import { scoreEra } from '../engine/scoring.js';
import { initialIndustryStock } from '../rules/industry-data.js';
import type { Bot } from './random.js';

const VP_WEIGHT = 3;
const MONEY_WEIGHT = 0.3;
const INCOME_WEIGHT = 2;
const PROGRESS_WEIGHT = 0.5;
const EARLY_IRON_BONUS = 5;
/** "Early" for the "prioritize iron early" heuristic (docs/PLANO.md M6): the first half of
 * the Canal era, when iron is scarcest relative to demand for Develop and Build. */
const EARLY_ROUND_CUTOFF = 4;
const TIE_EPSILON = 1e-9;

/**
 * Simple positional evaluation (docs/PLANO.md M6):
 * - Projected VP if the era ended right now (reuses the real, non-mutating scoreEra — this
 *   already rewards flipping tiles over leaving them unflipped, since only flipped tiles
 *   score) is the dominant term.
 * - Money and income are minor tie-breakers (liquidity and future income compound).
 * - A flat bonus for owning an unflipped iron works early in the Canal era.
 * - A small bonus per industry tile already removed from the player's starting stock (via
 *   Build or Develop), nudging toward tech progression over hoarding.
 */
export function evaluate(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId];
  if (player === undefined) return -Infinity;

  const scored = scoreEra(state);
  const projectedVp = scored.players[playerId]?.victoryPoints ?? 0;

  let score = VP_WEIGHT * projectedVp + MONEY_WEIGHT * player.money + INCOME_WEIGHT * incomeLevelForPosition(player.incomeTrackPosition);

  for (const industry of INDUSTRY_TYPES) {
    const removed = initialIndustryStock(industry).length - player.industryStock[industry].length;
    score += PROGRESS_WEIGHT * removed;
  }

  if (state.era === 'canal' && state.round <= EARLY_ROUND_CUTOFF) {
    const ownsUnflippedIronWorks = Object.values(state.locations).some((location) =>
      location.slots.some(
        (slot) =>
          slot.tile !== null &&
          slot.tile.owner === playerId &&
          slot.tile.industry === 'iron' &&
          !slot.tile.flipped,
      ),
    );
    if (ownsUnflippedIronWorks) score += EARLY_IRON_BONUS;
  }

  return score;
}

/** Greedy 1-ply bot: evaluates every legal action by simulating it and picks the best,
 * breaking ties uniformly at random. */
export const heuristicBot: Bot = (state, playerId, rng) => {
  const actions = legalActions(state, playerId);
  if (actions.length === 0) {
    throw new Error(`heuristicBot: no legal actions for ${playerId}`);
  }

  let bestScore = -Infinity;
  let bestActions: (typeof actions)[number][] = [];
  for (const action of actions) {
    const resultState = applyAction(state, action);
    const score = evaluate(resultState, playerId);
    if (score > bestScore + TIE_EPSILON) {
      bestScore = score;
      bestActions = [action];
    } else if (Math.abs(score - bestScore) <= TIE_EPSILON) {
      bestActions.push(action);
    }
  }

  return rng.pick(bestActions);
};
