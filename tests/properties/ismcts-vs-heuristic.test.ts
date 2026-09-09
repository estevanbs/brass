import { describe, expect, it } from 'vitest';
import { playGame } from '../../src/bots/harness.js';
import { heuristicBot } from '../../src/bots/heuristic.js';
import { makeIsmctsBot } from '../../src/bots/ismcts.js';

/**
 * docs/PLANO.md M7 "Pronto quando": ISMCTS should beat the M6 heuristic in >=65% of 300
 * games at a 1s/move budget. At that budget a single game takes 20-30s, so 300 games (~2
 * hours) only runs as the standalone `scripts/run-ismcts-validation.ts` — see
 * docs/PROGRESS.md for its recorded result. This in-suite test is a much smaller, faster
 * regression guard at a reduced time budget (docs/ASSUMPTIONS.md #14): it would catch a bot
 * that regressed to being no better than the heuristic, without costing minutes per `verify`.
 */
describe('ismctsBot vs heuristicBot (reduced-budget regression guard)', () => {
  it(
    'wins at least half of a small sample of games at a 250ms/move budget',
    () => {
      const GAMES = 12;
      const ismcts = makeIsmctsBot({ timeBudgetMs: 250 });
      let wins = 0;

      for (let i = 0; i < GAMES; i++) {
        const result = playGame(['ismcts', 'heuristic'], 6_000_000 + i, {
          ismcts,
          heuristic: heuristicBot,
        });
        if (result.winner === 'ismcts') wins++;
      }

      const winRate = wins / GAMES;
      console.log(`[ismcts vs heuristic, 250ms budget] ${wins}/${GAMES} wins (${(winRate * 100).toFixed(1)}%)`);
      expect(winRate).toBeGreaterThanOrEqual(0.5);
    },
    120_000,
  );
});
