import { readFileSync, writeFileSync } from 'node:fs';
import { createInitialState } from '../core/state.js';
import type { GameState, PlayerId } from '../core/types.js';
import type { Action } from '../engine/action-types.js';
import { applyAction } from '../engine/apply-action.js';
import { advanceAfterAction, skipEmptyHandTurns } from '../engine/cycle.js';

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

export function saveToFile(path: string, saved: SavedGame): void {
  writeFileSync(path, JSON.stringify(saved, null, 2), 'utf-8');
}

export function loadFromFile(path: string): SavedGame {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'));
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    !('seed' in parsed) ||
    !('playerIds' in parsed) ||
    !('actions' in parsed)
  ) {
    throw new Error(`${path} is not a valid saved game`);
  }
  return parsed as SavedGame;
}
