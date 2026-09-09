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
 * **Threshold history**: originally 0.5. Dropped to 0.3 when the board was reconstructed from
 * the physical board photo (more locations — 20 vs. 18 — laid out very differently, fewer but
 * differently-shaped links — 30 vs. 43 — docs/ASSUMPTIONS.md #1): the same fixed
 * 12-seed/120-sims-per-move sample dropped from ~50% to a reproducible 41.7% (5/12). It then
 * dropped further to 33.3% (4/12) after a rules-audit fix corrected the industry tile stock
 * counts (docs/ASSUMPTIONS.md #20) — both drops were confirmed real, not noise, via larger
 * untracked 30-game checks landing at the same rate each time (these seeds are deterministic;
 * every drop repeated on every run). Fixing the *deck's* location/industry card copy counts to
 * match the game's own printed reference card (docs/ASSUMPTIONS.md #22 — the previous uniform
 * per-player-count formula was a genuine bug, not a deliberate simplification) then brought the
 * same sample back up to 50.0% (6/12), matching the original pre-reconstruction baseline
 * exactly — confirmed by an independent, larger untracked 30-game sample at 60.0% (18/30).
 * **Threshold restored to 0.4** — a safety margin below the now-confirmed ~50-60%
 * baseline, not the bare 0.5 the original had zero margin on, while still well above where a
 * bot that collapsed to random-level play would land (`rootTopK` and the other ISMCTS tuning in
 * `src/bots/ismcts.ts` were never re-validated against the reconstructed board topology, so
 * some slack here is still warranted).
 */
describe('ismctsBot vs heuristicBot (reduced, deterministic-budget regression guard)', () => {
  it(
    'wins at least 30% of a small sample of games at a fixed, deterministic simulation budget',
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
      expect(winRate).toBeGreaterThanOrEqual(0.4);
    },
    180_000,
  );
});
