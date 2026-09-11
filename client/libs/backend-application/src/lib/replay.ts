import { applyAction, advanceAfterAction, createInitialState, skipEmptyHandTurns, type Action, type GameState, type PlayerId } from '@brass/backend-domain';

export interface SavedGame {
  readonly seed: number;
  readonly playerIds: readonly PlayerId[];
  readonly actions: readonly Action[];
}

/** Reconstructs the game state by replaying `saved.actions` from a fresh
 * `createInitialState(seed)` — the whole save format is just the seed + the action log,
 * since the engine is fully deterministic given both (docs/PLANO.md M8). */
export function replay(saved: SavedGame): GameState {
  let state = skipEmptyHandTurns(createInitialState(saved.playerIds, saved.seed));
  for (const action of saved.actions) {
    state = advanceAfterAction(applyAction(state, action));
  }
  return state;
}
