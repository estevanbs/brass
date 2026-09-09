import type { Action, Rng } from '@brass/backend-domain';

/**
 * Cheap, type-weighted action choice used inside MCTS rollouts (docs/PLANO.md M7: "rollouts
 * guiados pela heurística do M6, não puramente aleatórios"). Unlike bots/heuristic.ts's
 * `heuristicBot` — which simulates every legal action with a full applyAction call to score
 * it — this never simulates anything, so it stays cheap enough to call many times per
 * simulated rollout. It encodes the same broad priorities in weight form: prefer scoring
 * actions (Sell) and board development (Build/Network/Develop) over stalling (Loan/Scout/Pass).
 */
const TYPE_WEIGHTS: Readonly<Record<Action['type'], number>> = {
  sell: 6,
  build: 4,
  network: 3,
  develop: 2,
  loan: 1,
  scout: 1,
  pass: 0.1,
};

export function chooseRolloutAction(actions: readonly Action[], rng: Rng): Action {
  if (actions.length === 0) {
    throw new Error('chooseRolloutAction: no actions to choose from');
  }
  const weights = actions.map((a) => TYPE_WEIGHTS[a.type]);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < actions.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) {
      const action = actions[i];
      if (action !== undefined) return action;
    }
  }
  const last = actions[actions.length - 1];
  if (last === undefined) throw new Error('unreachable');
  return last;
}
