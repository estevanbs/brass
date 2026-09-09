import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/core/state.js';
import { mulberry32 } from '../../src/core/rng.js';
import { legalActions } from '../../src/engine/legal/index.js';
import { applyAction } from '../../src/engine/apply-action.js';
import { advanceAfterAction, skipEmptyHandTurns } from '../../src/engine/cycle.js';

/**
 * docs/PLANO.md M4: "Benchmark registrado: tamanho médio e máximo da lista ao longo de uma
 * partida." Plays full random games (see docs/PROGRESS.md for the recorded numbers) and
 * asserts the game always finishes with a legal action available on every turn — the actual
 * regression this guards against is the "no legal actions -> stuck game" bug found while
 * building M4 (an uneven, empty-handed player with no card left to discard).
 */
describe('legalActions benchmark', () => {
  it('finishes full random games for 2, 3, and 4 players without ever running out of legal actions', () => {
    for (const playerCount of [2, 3, 4]) {
      const players = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);
      let state = skipEmptyHandTurns(createInitialState(players, playerCount * 101));
      const rng = mulberry32(playerCount * 37 + 11);

      let turns = 0;
      let maxSize = 0;
      let totalSize = 0;
      while (!state.gameOver && turns < 3000) {
        const activeId = state.turnOrder[state.activePlayerIndex];
        if (activeId === undefined) throw new Error('unreachable');
        const actions = legalActions(state, activeId);
        expect(actions.length).toBeGreaterThan(0);
        maxSize = Math.max(maxSize, actions.length);
        totalSize += actions.length;

        const chosen = actions[rng.nextInt(actions.length)];
        if (chosen === undefined) throw new Error('unreachable');
        state = applyAction(state, chosen);
        state = advanceAfterAction(state);
        turns++;
      }

      expect(state.gameOver).toBe(true);
      console.log(
        `[legalActions benchmark] ${playerCount}p: ${turns} turns, avg size ${Math.round(totalSize / turns)}, max size ${maxSize}`,
      );
    }
  });
});
