import { describe, expect, it } from 'vitest';
import { advanceAfterAction } from '../../src/engine/cycle.js';
import { makePlayer, makeState, tile, withTile } from '../helpers/fixtures.js';

describe('advanceAfterAction', () => {
  it('is a no-op while the active player still has actions left this turn', () => {
    const state = makeState({ actionsTakenThisTurn: 1 });
    const result = advanceAfterAction(state);
    expect(result).toEqual(state);
  });

  it('refills the active hand and moves to the next player once their turn is done', () => {
    const state = makeState({
      actionsTakenThisTurn: 2,
      players: {
        p1: makePlayer('p1', { hand: [{ kind: 'wildLocation' }] }),
        p2: makePlayer('p2'),
      },
      drawDeck: [
        { kind: 'wildLocation' },
        { kind: 'wildLocation' },
        { kind: 'wildLocation' },
        { kind: 'wildLocation' },
        { kind: 'wildLocation' },
        { kind: 'wildLocation' },
        { kind: 'wildLocation' },
      ],
    });
    const result = advanceAfterAction(state);
    expect(result.players['p1']?.hand).toHaveLength(8);
    expect(result.activePlayerIndex).toBe(1);
    expect(result.actionsTakenThisTurn).toBe(0);
    expect(result.drawDeck).toHaveLength(0);
  });

  it('reorders turnOrder by spending (least first) at the end of a round and pays income', () => {
    const state = makeState({
      activePlayerIndex: 1,
      actionsTakenThisTurn: 2,
      turnOrder: ['p1', 'p2'],
      players: {
        p1: makePlayer('p1', { spentThisRound: 20, incomeTrackPosition: 10, hand: [{ kind: 'wildLocation' }] }),
        p2: makePlayer('p2', { spentThisRound: 5, incomeTrackPosition: 10, hand: [{ kind: 'wildLocation' }] }),
      },
    });
    const result = advanceAfterAction(state);
    expect(result.turnOrder).toEqual(['p2', 'p1']);
    expect(result.players['p1']?.spentThisRound).toBe(0);
    expect(result.round).toBe(3);
    // income level at position 10 is 0, so money is unchanged.
    expect(result.players['p1']?.money).toBe(30);
  });

  it('pays positive income at the end of a round', () => {
    const state = makeState({
      activePlayerIndex: 1,
      actionsTakenThisTurn: 2,
      players: {
        p1: makePlayer('p1', { incomeTrackPosition: 30, hand: [{ kind: 'wildLocation' }] }), // level 10
        p2: makePlayer('p2', { hand: [{ kind: 'wildLocation' }] }),
      },
    });
    const result = advanceAfterAction(state);
    expect(result.players['p1']?.money).toBe(40);
  });

  it('covers a negative-income shortfall by removing tiles at half their cost, then losing VP for the rest', () => {
    let state = makeState({
      activePlayerIndex: 1,
      actionsTakenThisTurn: 2,
      players: {
        p1: makePlayer('p1', {
          money: 0,
          incomeTrackPosition: 0,
          victoryPoints: 5,
          hand: [{ kind: 'wildLocation' }],
        }), // level -10
        p2: makePlayer('p2', { hand: [{ kind: 'wildLocation' }] }),
      },
    });
    state = { ...state, locations: withTile(state.locations, 'birmingham', 0, tile('p1', 'iron', 1, 2)) };
    const result = advanceAfterAction(state);
    // shortfall £10: selling the iron L1 tile (cost £5) refunds £2 (floor(5/2)), leaving £8 short -> 8 VP lost.
    expect(result.players['p1']?.money).toBe(0);
    expect(result.players['p1']?.victoryPoints).toBe(0); // 5 - 8 clamped at 0
    const birmingham = result.locations['birmingham'];
    if (birmingham === undefined || birmingham.kind === 'market') throw new Error('unreachable');
    expect(birmingham.slots[0]?.tile).toBeNull();
  });

  it('triggers the canal-to-rail era transition once the deck and every hand are empty', () => {
    const state = makeState({
      era: 'canal',
      activePlayerIndex: 1,
      actionsTakenThisTurn: 2,
      drawDeck: [],
      players: {
        p1: makePlayer('p1', { hand: [] }),
        p2: makePlayer('p2', { hand: [] }),
      },
    });
    const result = advanceAfterAction(state);
    expect(result.era).toBe('rail');
  });

  it('ends the game once the rail era deck and every hand are empty, skipping income', () => {
    const state = makeState({
      era: 'rail',
      activePlayerIndex: 1,
      actionsTakenThisTurn: 2,
      drawDeck: [],
      players: {
        p1: makePlayer('p1', { hand: [], incomeTrackPosition: 30 }),
        p2: makePlayer('p2', { hand: [] }),
      },
    });
    const result = advanceAfterAction(state);
    expect(result.gameOver).toBe(true);
    expect(result.players['p1']?.money).toBe(30); // income not paid on the final round
  });

  it('is a no-op once the game is already over', () => {
    const state = makeState({ gameOver: true, actionsTakenThisTurn: 2 });
    expect(advanceAfterAction(state)).toEqual(state);
  });
});
