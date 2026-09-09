import { describe, expect, it } from 'vitest';
import { playGame } from '../../src/bots/harness.js';
import { heuristicBot } from '../../src/bots/heuristic.js';
import { makeIsmctsBot } from '../../src/bots/ismcts.js';

/**
 * docs/PLANO.md M7 "Pronto quando": ISMCTS should beat the M6 heuristic in >=65% of 300
 * games at a 1s/move budget. At that budget a single game takes 20-30s, so 300 games (~2
 * hours) only runs as the standalone `scripts/run-ismcts-validation.ts` — see
 * docs/PROGRESS.md for its recorded result. This in-suite test is a much smaller, faster
 * regression guard (docs/ASSUMPTIONS.md #14): it would catch a bot that regressed to being no
 * better than the heuristic, without costing minutes per `verify`.
 *
 * It bounds the bot by `maxTotalSimulations`, not `timeBudgetMs`: a real-time budget makes
 * move quality (and so game outcomes) depend on machine speed/load, which violates this
 * project's own testing rule (docs/PLANO.md: "nenhum teste depende de tempo real") — this
 * test genuinely flaked on a real-time budget once, when it ran under load from other
 * `verify` tests. `timeBudgetMs` here is only a generous safety net, never the limiting factor.
 *
 * **Threshold history** (all on the same fixed 12-seed/120-sims-per-move sample, deterministic
 * so every number below repeats identically on every run). Originally 0.5. Dropped to 0.3 when
 * the board was first reconstructed from a board photo (more locations, very different link
 * layout — docs/ASSUMPTIONS.md #1): win rate fell from ~50% to 41.7% (5/12), confirmed as a
 * real, reproducible drop (not small-sample noise) by an independent 30-game check landing in
 * the same range. Dropped further to 33.3% (4/12) after a rules-audit fix corrected the
 * industry tile stock counts (docs/ASSUMPTIONS.md #20) — again confirmed real by a 30-game
 * check. Recovered to 50.0% (6/12) after fixing the deck's location/industry card copy counts
 * to match the game's own reference card (docs/ASSUMPTIONS.md #22, confirmed by a 30-game
 * check at 60.0%), and the threshold was raised to 0.4 accordingly. Then, re-tracing every
 * link's era against a much higher-resolution board photo corrected about a third of them —
 * including one outright wrong connection, Uttoxeter–Derby instead of Uttoxeter–Burton-on-Trent
 * (docs/ASSUMPTIONS.md #23) — dropped the 12-seed rate to 41.7% (5/12) again, but this time an
 * independent 30-game check did NOT confirm a real drop (it came back at 60.0%, above the
 * baseline) — most likely just this test's 12 fixed seeds landing on the unlucky side of
 * ordinary small-sample variance, not a systematic regression. Finally, the board was rewritten
 * a third time from `docs/BUILDINGS.md`/`docs/CONECTIONS.md` — two files the user wrote by hand
 * and declared this project's final source of truth for board slots and link connectivity/era,
 * superseding every photo-based reconstruction above (docs/ASSUMPTIONS.md #24). That rewrite
 * changed the board substantially (39 links instead of 30, very different per-location slots)
 * and pushed the 12-seed rate up to **75.0% (9/12)** — comfortably the highest of any topology
 * tried so far, confirmed by an independent 30-game check at 63.3% (19/30), the same high
 * range. **Threshold raised to 0.5**, back to its original value and with a large safety
 * margin under the new baseline. `rootTopK` and the rest of the ISMCTS tuning in
 * `src/bots/ismcts.ts` have never been re-validated against any of these board revisions —
 * that revalidation is real, un-done follow-up work, not something to fold into a board data
 * fix.
 */
describe('ismctsBot vs heuristicBot (reduced, deterministic-budget regression guard)', () => {
  it(
    'wins at least 50% of a small sample of games at a fixed, deterministic simulation budget',
    () => {
      const GAMES = 12;
      const ismcts = makeIsmctsBot({ maxTotalSimulations: 120, timeBudgetMs: 30_000 });
      let wins = 0;

      for (let i = 0; i < GAMES; i++) {
        const result = playGame(['ismcts', 'heuristic'], 6_000_000 + i, {
          ismcts,
          heuristic: heuristicBot,
        });
        if (result.winner === 'ismcts') wins++;
      }

      const winRate = wins / GAMES;
      console.log(`[ismcts vs heuristic, 120 sims/move] ${wins}/${GAMES} wins (${(winRate * 100).toFixed(1)}%)`);
      expect(winRate).toBeGreaterThanOrEqual(0.5);
    },
    180_000,
  );
});
