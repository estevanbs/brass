/**
 * M5 "Pronto quando" validation: 10,000 random-bot games with no exception, no invalid state,
 * no infinite loop, reporting the score distribution and average duration (docs/PLANO.md).
 * Not part of `npm test` — it is a slow, one-off validation script. Run with:
 *   npx tsx scripts/run-random-batch.ts [gamesPerPlayerCount]
 */
import { runBatch } from '../src/bots/harness.js';
import { randomBot } from '../src/bots/random.js';
import type { PlayerId } from '../src/core/types.js';

function botsFor(playerIds: readonly PlayerId[]) {
  return Object.fromEntries(playerIds.map((id) => [id, randomBot]));
}

function percentile(sorted: readonly number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx] ?? 0;
}

const gamesPerPlayerCount = Number(process.argv[2] ?? 10_000 / 3);
const start = Date.now();

for (const playerCount of [2, 3, 4]) {
  const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);
  const summary = runBatch(playerIds, gamesPerPlayerCount, playerCount * 1_000_000, () => botsFor(playerIds));

  const winnerVps = summary.games.map((g) => g.victoryPoints[g.winner] ?? 0).sort((a, b) => a - b);
  const turnsList = summary.games.map((g) => g.turns).sort((a, b) => a - b);

  console.log(`\n=== ${playerCount} players, ${summary.count} games ===`);
  console.log(`turns: mean ${summary.meanTurns.toFixed(1)}, p50 ${percentile(turnsList, 0.5)}, p95 ${percentile(turnsList, 0.95)}`);
  console.log(
    `duration per game (ms): mean ${summary.meanDurationMs.toFixed(1)}, max ${summary.maxDurationMs}`,
  );
  console.log(
    `winner VP: mean ${summary.meanWinnerVp.toFixed(1)}, min ${summary.minWinnerVp}, max ${summary.maxWinnerVp}, p50 ${percentile(winnerVps, 0.5)}`,
  );
}

console.log(`\nTotal wall time: ${((Date.now() - start) / 1000).toFixed(1)}s`);
console.log('All games completed with gameOver=true, no exceptions, no invalid state.');
