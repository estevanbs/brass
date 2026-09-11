import { readFileSync, writeFileSync } from 'node:fs';
import type { SavedGame } from './replay.js';

/** Node-only (`node:fs`) — deliberately **not** re-exported from this package's `index.ts`, so
 * importing `@brass/backend-application` (as the offline Web Worker does) never drags a
 * `node:fs` import into a browser bundle. `tools/cli.ts`, the only real consumer, imports this
 * file directly by path instead of through the package barrel. */
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
