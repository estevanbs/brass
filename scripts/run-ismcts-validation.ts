/**
 * M7 "Pronto quando" validation: 300 head-to-head games, ISMCTS (1s/move budget) vs the M6
 * heuristic bot, expecting a >=65% win rate (docs/PLANO.md). Not part of `npm test` — at
 * ~20-30s per game this takes hours, so it's a standalone script. Run with:
 *   npx tsx scripts/run-ismcts-validation.ts [gameCount] [budgetMs]
 */
import { playGame } from '../src/bots/harness.js';
import { heuristicBot } from '../src/bots/heuristic.js';
import { makeIsmctsBot } from '../src/bots/ismcts.js';

const gameCount = Number(process.argv[2] ?? 300);
const budgetMs = Number(process.argv[3] ?? 1000);
const ismcts = makeIsmctsBot({ timeBudgetMs: budgetMs });

let wins = 0;
const start = Date.now();
for (let i = 0; i < gameCount; i++) {
  const result = playGame(['ismcts', 'heuristic'], 9_000_000 + i, { ismcts, heuristic: heuristicBot });
  if (result.winner === 'ismcts') wins++;
  const elapsedMin = (Date.now() - start) / 60_000;
  console.log(
    `game ${i + 1}/${gameCount}: winner=${result.winner} vps=${JSON.stringify(result.victoryPoints)} ` +
      `(running win rate ${((wins / (i + 1)) * 100).toFixed(1)}%, ${elapsedMin.toFixed(1)}min elapsed)`,
  );
}

const winRate = wins / gameCount;
console.log(`\nFinal: ${wins}/${gameCount} ISMCTS wins (${(winRate * 100).toFixed(1)}%)`);
console.log(winRate >= 0.65 ? 'MEETS the >=65% M7 target.' : 'DOES NOT meet the >=65% M7 target.');
