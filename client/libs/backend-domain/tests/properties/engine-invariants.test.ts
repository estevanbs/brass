import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createInitialState } from '../../src/lib/core/state.js';
import type { GameState } from '../../src/lib/core/types.js';
import { applyAction } from '../../src/lib/engine/apply-action.js';
import { advanceAfterAction } from '../../src/lib/engine/cycle.js';
import { COAL_MARKET_CAPACITY, IRON_MARKET_CAPACITY } from '../../src/lib/engine/market.js';

/**
 * docs/PLANO.md M3 property requirement, scoped to the actions that need no board state to be
 * legal (Pass and Loan): for any reachable state and any legal action of this kind,
 * applyAction + advanceAfterAction must never produce negative money/VP or out-of-range
 * market cubes. The broader "any legal action" property (covering Build/Network/Sell/Develop)
 * is deferred to M4, once legalActions() exists to generate legal actions of every kind to
 * fuzz against — see docs/PROGRESS.md.
 */
function assertInvariants(state: GameState): void {
  for (const player of Object.values(state.players)) {
    expect(player.money).toBeGreaterThanOrEqual(0);
    expect(player.victoryPoints).toBeGreaterThanOrEqual(0);
    expect(player.incomeTrackPosition).toBeGreaterThanOrEqual(0);
    expect(player.incomeTrackPosition).toBeLessThanOrEqual(99);
    expect(player.linkTilesRemaining).toBeGreaterThanOrEqual(0);
  }
  expect(state.market.coalCubes).toBeGreaterThanOrEqual(0);
  expect(state.market.coalCubes).toBeLessThanOrEqual(COAL_MARKET_CAPACITY);
  expect(state.market.ironCubes).toBeGreaterThanOrEqual(0);
  expect(state.market.ironCubes).toBeLessThanOrEqual(IRON_MARKET_CAPACITY);
  for (const location of Object.values(state.locations)) {
    for (const slot of location.slots) {
      if (slot.tile !== null) {
        expect(slot.tile.resourceRemaining).toBeGreaterThanOrEqual(0);
      }
    }
  }
}

describe('engine invariants under arbitrary Pass/Loan sequences', () => {
  it('never produces negative money, negative VP, or out-of-range market cubes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(fc.boolean(), { minLength: 0, maxLength: 60 }),
        (seed, chooseLoan) => {
          let state = createInitialState(['p1', 'p2'], seed);
          assertInvariants(state);

          for (const preferLoan of chooseLoan) {
            if (state.gameOver) break;
            const activeId = state.turnOrder[state.activePlayerIndex];
            if (activeId === undefined) throw new Error('unreachable');
            const player = state.players[activeId];
            if (player === undefined) throw new Error('unreachable');
            if (player.hand.length === 0) break;
            const card = player.hand[0];
            if (card === undefined) throw new Error('unreachable');

            const action = preferLoan
              ? ({ type: 'loan', player: activeId, card } as const)
              : ({ type: 'pass', player: activeId, card } as const);

            let next: GameState;
            try {
              next = applyAction(state, action);
            } catch {
              // A loan that would drop below level -10 is the only expected failure here.
              next = applyAction(state, { type: 'pass', player: activeId, card });
            }
            state = advanceAfterAction(next);
            assertInvariants(state);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
