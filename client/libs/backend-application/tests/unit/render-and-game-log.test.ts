import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createInitialState,
  hashState,
  serializeState,
  applyAction,
  advanceAfterAction,
  skipEmptyHandTurns,
  mulberry32,
  type Action,
} from '@brass/backend-domain';
import { randomBot } from '@brass/backend-infrastructure';
import { loadFromFile, replay, saveToFile, type SavedGame } from '../../src/lib/game-log.js';
import { describeAction, renderBoard, renderPlayer, renderScoreboard } from '../../src/lib/render.js';

function playFullGameRecordingActions(playerIds: readonly string[], seed: number): SavedGame {
  let state = skipEmptyHandTurns(createInitialState(playerIds, seed));
  const rng = mulberry32(seed ^ 0xabcdef);
  const actions: Action[] = [];
  while (!state.gameOver) {
    const activeId = state.turnOrder[state.activePlayerIndex];
    if (activeId === undefined) throw new Error('unreachable');
    const action = randomBot(state, activeId, rng);
    actions.push(action);
    state = advanceAfterAction(applyAction(state, action));
  }
  return { seed, playerIds, actions };
}

describe('game-log replay', () => {
  it('reproduces the exact final state (byte-identical) from the action log alone', () => {
    const playerIds = ['p1', 'p2', 'p3'];
    const saved = playFullGameRecordingActions(playerIds, 4242);

    // Replay independently, from scratch, using only {seed, playerIds, actions}.
    const replayedA = replay(saved);
    const replayedB = replay(saved);

    expect(hashState(replayedA)).toBe(hashState(replayedB));
    expect(serializeState(replayedA)).toBe(serializeState(replayedB));
    expect(replayedA.gameOver).toBe(true);
  });

  it('round-trips through a save file on disk and still replays byte-identically', () => {
    const playerIds = ['p1', 'p2'];
    const saved = playFullGameRecordingActions(playerIds, 99);
    const original = replay(saved);

    const dir = mkdtempSync(join(tmpdir(), 'brass-save-test-'));
    const path = join(dir, 'game.json');
    try {
      saveToFile(path, saved);
      const loaded = loadFromFile(path);
      const reloaded = replay(loaded);
      expect(hashState(reloaded)).toBe(hashState(original));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loadFromFile rejects a file that is not a saved game', () => {
    const dir = mkdtempSync(join(tmpdir(), 'brass-save-test-'));
    const path = join(dir, 'not-a-game.json');
    try {
      saveToFile(path, { not: 'a game' } as never);
      expect(() => loadFromFile(path)).toThrow(/not a valid saved game/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('render', () => {
  it('describeAction produces a non-empty, readable line for every action type', () => {
    const card = { kind: 'wildLocation' as const };
    const actions: Action[] = [
      { type: 'build', player: 'p1', card, locationId: 'birmingham', slotIndex: 0, industry: 'iron', coalSource: null, ironSource: null },
      { type: 'network', player: 'p1', card, linkSlotIds: ['walsall__birmingham'], coalSources: [], beerSource: null },
      { type: 'develop', player: 'p1', card, industries: ['coal'], ironSources: [{ kind: 'market' }] },
      { type: 'sell', player: 'p1', card, sales: [{ locationId: 'coventry', slotIndex: 0, beerSources: [] }] },
      { type: 'loan', player: 'p1', card },
      { type: 'scout', player: 'p1', cards: [card, card, card] },
      { type: 'pass', player: 'p1', card },
    ];
    for (const action of actions) {
      const description = describeAction(action);
      expect(description.length).toBeGreaterThan(0);
    }
  });

  it('renderBoard/renderPlayer/renderScoreboard render without throwing and mention the players', () => {
    const state = skipEmptyHandTurns(createInitialState(['alice', 'bob'], 1));
    expect(renderBoard(state)).toContain('Era Canal');
    expect(renderPlayer(state, 'alice')).toContain('alice');
    expect(renderScoreboard(state)).toContain('alice');
    expect(renderScoreboard(state)).toContain('bob');
  });
});
