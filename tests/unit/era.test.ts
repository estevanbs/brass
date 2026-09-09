import { describe, expect, it } from 'vitest';
import { endEra } from '../../src/engine/era.js';
import { makePlayer, makeState, tile, withMerchant, withTile } from '../helpers/fixtures.js';

describe('endEra (canal -> rail)', () => {
  it('removes all level-1 industry tiles from the board but keeps level 2+', () => {
    let state = makeState({ era: 'canal' });
    state = {
      ...state,
      locations: withTile(
        withTile(state.locations, 'birmingham', 0, tile('p1', 'iron', 1, 0, true)),
        'wolverhampton',
        0,
        tile('p2', 'coal', 3, 0, true),
      ),
    };
    const result = endEra(state);
    const birmingham = result.locations['birmingham'];
    const wolverhampton = result.locations['wolverhampton'];
    if (birmingham === undefined || birmingham.kind === 'market') throw new Error('unreachable');
    if (wolverhampton === undefined || wolverhampton.kind === 'market') throw new Error('unreachable');
    expect(birmingham.slots[0]?.tile).toBeNull();
    expect(wolverhampton.slots[0]?.tile).not.toBeNull();
  });

  it('resets merchant beer at non-blank slots', () => {
    let state = makeState({ era: 'canal' });
    state = { ...state, locations: withMerchant(state.locations, 'warrington', 0, 'cotton', false) };
    const result = endEra(state);
    const warrington = result.locations['warrington'];
    if (warrington === undefined || warrington.kind !== 'market') throw new Error('unreachable');
    expect(warrington.merchantSlots[0]?.hasBeer).toBe(true);
  });

  it('reshuffles all discard piles into a fresh deck and deals 8 cards per player', () => {
    const state = makeState({
      era: 'canal',
      players: {
        p1: makePlayer('p1', {
          discardPile: Array.from({ length: 10 }, () => ({
            kind: 'industry' as const,
            industry: 'coal' as const,
          })),
        }),
        p2: makePlayer('p2', {
          discardPile: Array.from({ length: 10 }, () => ({ kind: 'wildLocation' as const })),
        }),
      },
    });
    const result = endEra(state);
    expect(result.players['p1']?.hand).toHaveLength(8);
    expect(result.players['p2']?.hand).toHaveLength(8);
    expect(result.players['p1']?.discardPile).toHaveLength(0);
    expect(result.drawDeck).toHaveLength(20 - 16);
  });

  it('restocks link tiles to 14 and switches to the rail era', () => {
    const state = makeState({
      era: 'canal',
      players: { p1: makePlayer('p1', { linkTilesRemaining: 2 }), p2: makePlayer('p2') },
    });
    const result = endEra(state);
    expect(result.era).toBe('rail');
    expect(result.round).toBe(1);
    expect(result.players['p1']?.linkTilesRemaining).toBe(14);
    expect(result.gameOver).toBe(false);
  });

  it('does not mutate the input state', () => {
    const state = makeState({ era: 'canal' });
    const before = JSON.stringify(state);
    endEra(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('endEra (rail -> game over)', () => {
  it('scores the era and ends the game without touching the deck or hands', () => {
    let state = makeState({ era: 'rail' });
    state = { ...state, locations: withTile(state.locations, 'birmingham', 0, tile('p1', 'iron', 4, 0, true)) };
    const result = endEra(state);
    expect(result.gameOver).toBe(true);
    expect(result.players['p1']?.victoryPoints).toBe(5);
  });
});
