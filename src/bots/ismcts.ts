import { canonicalize } from '../core/state.js';
import type { GameState, PlayerId } from '../core/types.js';
import type { Rng } from '../core/rng.js';
import type { Action } from '../engine/action-types.js';
import { applyAction } from '../engine/apply-action.js';
import { advanceAfterAction } from '../engine/cycle.js';
import { determinize } from '../engine/determinize.js';
import { legalActions } from '../engine/legal/index.js';
import { evaluate } from './heuristic.js';
import { chooseRolloutAction } from './rollout-policy.js';
import type { Bot } from './random.js';

function actionKey(action: Action): string {
  return JSON.stringify(canonicalize(action));
}

/**
 * Brass routinely offers 100-600+ legal actions per turn (docs/PROGRESS.md M4 benchmark). A
 * simulation budget of a few hundred sims can't even try every root action once, so visit
 * counts over the full set are close to noise. Narrowing the root to its top-scoring
 * candidates (by the same 1-ply lookahead as bots/heuristic.ts) lets MCTS spend its budget
 * telling a handful of genuinely promising moves apart instead — see docs/ASSUMPTIONS.md #14.
 */
function topActionsByHeuristic(state: GameState, playerId: PlayerId, actions: readonly Action[], topK: number): Action[] {
  if (actions.length <= topK) return actions.slice();
  const scored = actions.map((action) => ({
    action,
    score: evaluate(advanceAfterAction(applyAction(state, action)), playerId),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.action);
}

function step(state: GameState, action: Action): GameState {
  return advanceAfterAction(applyAction(state, action));
}

interface Node {
  readonly state: GameState;
  readonly parent: Node | null;
  readonly playerToAct: PlayerId | null;
  untriedActions: Action[];
  readonly children: Map<string, Node>;
  visits: number;
  readonly valueSum: Record<PlayerId, number>;
}

function makeNode(state: GameState, parent: Node | null, actionsOverride?: Action[]): Node {
  const playerToAct = state.gameOver ? null : (state.turnOrder[state.activePlayerIndex] ?? null);
  const untriedActions = playerToAct === null ? [] : (actionsOverride ?? legalActions(state, playerToAct));
  return { state, parent, playerToAct, untriedActions, children: new Map(), visits: 0, valueSum: {} };
}

const EXPLORATION = Math.SQRT2;

function selectChild(node: Node): Node {
  const acting = node.playerToAct;
  if (acting === null) throw new Error('unreachable: cannot select from a terminal node');
  let best: Node | null = null;
  let bestScore = -Infinity;
  for (const child of node.children.values()) {
    const exploit = (child.valueSum[acting] ?? 0) / child.visits;
    const explore = EXPLORATION * Math.sqrt(Math.log(node.visits) / child.visits);
    const score = exploit + explore;
    if (score > bestScore) {
      bestScore = score;
      best = child;
    }
  }
  if (best === null) throw new Error('unreachable: no children to select from');
  return best;
}

/** Depth-limited rollout using the cheap heuristic-weighted policy, then a static evaluation
 * of the resulting state per player (docs/PLANO.md M7: "rollouts guiados pela heurística do
 * M6, não puramente aleatórios" — the rollout policy is heuristic-weighted, and the leaf
 * value directly reuses M6's `evaluate`, see docs/ASSUMPTIONS.md #14). */
function rolloutAndEvaluate(state: GameState, rng: Rng, depth: number): Record<PlayerId, number> {
  let current = state;
  for (let i = 0; i < depth && !current.gameOver; i++) {
    const playerToAct = current.turnOrder[current.activePlayerIndex];
    if (playerToAct === undefined) break;
    const actions = legalActions(current, playerToAct);
    if (actions.length === 0) break;
    current = step(current, chooseRolloutAction(actions, rng));
  }
  const rewards: Record<PlayerId, number> = {};
  for (const id of Object.keys(current.players)) {
    rewards[id] = evaluate(current, id);
  }
  return rewards;
}

function simulate(root: Node, rng: Rng, rolloutDepth: number): void {
  let node = root;
  while (node.playerToAct !== null && node.untriedActions.length === 0 && node.children.size > 0) {
    node = selectChild(node);
  }

  if (node.playerToAct !== null && node.untriedActions.length > 0) {
    const idx = rng.nextInt(node.untriedActions.length);
    const action = node.untriedActions[idx];
    if (action === undefined) throw new Error('unreachable');
    node.untriedActions.splice(idx, 1);
    const child = makeNode(step(node.state, action), node);
    node.children.set(actionKey(action), child);
    node = child;
  }

  const rewards = rolloutAndEvaluate(node.state, rng, rolloutDepth);

  let cursor: Node | null = node;
  while (cursor !== null) {
    cursor.visits += 1;
    for (const [player, value] of Object.entries(rewards)) {
      cursor.valueSum[player] = (cursor.valueSum[player] ?? 0) + value;
    }
    cursor = cursor.parent;
  }
}

export interface IsmctsConfig {
  /** Wall-clock budget for one move, split across as many determinized "worlds" as fit. */
  readonly timeBudgetMs?: number;
  /** Simulations run per world before moving on to the next determinization. */
  readonly simulationsPerWorld?: number;
  /** How many additional actions a rollout plays before it is scored, per player. */
  readonly rolloutDepth?: number;
  /** Root actions are narrowed to their top-scoring candidates before search — see
   * `topActionsByHeuristic`. */
  readonly rootTopK?: number;
}

const DEFAULT_CONFIG: Required<IsmctsConfig> = {
  timeBudgetMs: 1000,
  simulationsPerWorld: 40,
  rolloutDepth: 4,
  rootTopK: 8,
};

/**
 * Information Set MCTS with root determinization (docs/PLANO.md M7): repeatedly samples a
 * plausible redeal of every hidden card (engine/determinize.ts), runs a standard
 * perfect-information MCTS in that one sampled "world" for a fixed simulation budget, and
 * aggregates each candidate action's visit count across all worlds — the action visited most
 * overall is played. See docs/ASSUMPTIONS.md #14 for what this simplifies relative to a
 * single shared information-set tree.
 */
export function makeIsmctsBot(config: IsmctsConfig = {}): Bot {
  const { timeBudgetMs, simulationsPerWorld, rolloutDepth, rootTopK } = { ...DEFAULT_CONFIG, ...config };

  return (state, playerId, rng) => {
    const rootActions = legalActions(state, playerId);
    if (rootActions.length === 0) {
      throw new Error(`ismctsBot: no legal actions for ${playerId}`);
    }
    if (rootActions.length === 1) {
      const only = rootActions[0];
      if (only === undefined) throw new Error('unreachable');
      return only;
    }

    const shortlist = topActionsByHeuristic(state, playerId, rootActions, rootTopK);
    const keyToAction = new Map<string, Action>();
    const aggregateVisits = new Map<string, number>();
    for (const action of shortlist) {
      const key = actionKey(action);
      keyToAction.set(key, action);
      aggregateVisits.set(key, 0);
    }

    const deadline = Date.now() + timeBudgetMs;
    let totalSimulations = 0;
    while (Date.now() < deadline) {
      const world = determinize(state, rng, playerId);
      const root = makeNode(world, null, shortlist.slice());
      for (let i = 0; i < simulationsPerWorld && Date.now() < deadline; i++) {
        simulate(root, rng, rolloutDepth);
        totalSimulations++;
      }
      for (const [key, child] of root.children) {
        aggregateVisits.set(key, (aggregateVisits.get(key) ?? 0) + child.visits);
      }
    }

    if (totalSimulations === 0) {
      return chooseRolloutAction(rootActions, rng);
    }

    let bestKey: string | null = null;
    let bestVisits = -1;
    for (const [key, visits] of aggregateVisits) {
      if (visits > bestVisits) {
        bestVisits = visits;
        bestKey = key;
      }
    }
    const chosen = bestKey === null ? undefined : keyToAction.get(bestKey);
    return chosen ?? rootActions[0]!;
  };
}
