import { describe, expect, it } from 'vitest';
import { playGame, randomBot, heuristicBot } from '../../src/index.js';

/**
 * docs/PLANO.md M6 "Pronto quando": vence o bot aleatório em pelo menos 80% de 1.000
 * partidas. This test IS that regression guard — it fails if the win rate ever drops below
 * the threshold.
 */
describe('heuristicBot vs randomBot', () => {
  it(
    'wins at least 80% of 1000 head-to-head games',
    () => {
      const GAMES = 1000;
      const playerIds = ['heuristic', 'random'];
      let wins = 0;

      for (let i = 0; i < GAMES; i++) {
        const result = playGame(playerIds, 500_000 + i, {
          heuristic: heuristicBot,
          random: randomBot,
        });
        if (result.winner === 'heuristic') wins++;
      }

      const winRate = wins / GAMES;
      console.log(`[heuristic vs random] ${wins}/${GAMES} wins (${(winRate * 100).toFixed(1)}%)`);
      expect(winRate).toBeGreaterThanOrEqual(0.8);
    },
    300_000,
  );
});
