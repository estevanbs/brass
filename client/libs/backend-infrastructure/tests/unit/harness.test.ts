import { describe, expect, it } from 'vitest';
import { playGame, runBatch, randomBot } from '../../src/index.js';
import type { PlayerId } from '@brass/backend-domain';

function botsFor(playerIds: readonly PlayerId[]) {
  return Object.fromEntries(playerIds.map((id) => [id, randomBot]));
}

describe('playGame (random bots)', () => {
  it('finishes 2/3/4-player games without throwing, ending with gameOver true', () => {
    for (const playerCount of [2, 3, 4]) {
      const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);
      const result = playGame(playerIds, 12345 + playerCount, botsFor(playerIds));
      expect(result.finalState.gameOver).toBe(true);
      expect(result.turns).toBeGreaterThan(0);
      expect(Object.keys(result.victoryPoints)).toHaveLength(playerCount);
      for (const vp of Object.values(result.victoryPoints)) {
        expect(vp).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('is deterministic for a fixed seed', () => {
    const playerIds = ['p1', 'p2', 'p3'];
    const a = playGame(playerIds, 777, botsFor(playerIds));
    const b = playGame(playerIds, 777, botsFor(playerIds));
    expect(a.turns).toBe(b.turns);
    expect(a.victoryPoints).toEqual(b.victoryPoints);
    expect(a.winner).toBe(b.winner);
  });
});

describe('runBatch (random bots, small smoke sample)', () => {
  it('runs a handful of games per player count without exceptions or invalid state', () => {
    for (const playerCount of [2, 3, 4]) {
      const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);
      const summary = runBatch(playerIds, 8, playerCount * 10_000, () => botsFor(playerIds));
      expect(summary.count).toBe(8);
      expect(summary.meanTurns).toBeGreaterThan(0);
      for (const game of summary.games) {
        expect(game.finalState.gameOver).toBe(true);
        expect(game.finalState.market.coalCubes).toBeGreaterThanOrEqual(0);
        expect(game.finalState.market.ironCubes).toBeGreaterThanOrEqual(0);
        for (const player of Object.values(game.finalState.players)) {
          expect(player.money).toBeGreaterThanOrEqual(0);
          expect(player.victoryPoints).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
