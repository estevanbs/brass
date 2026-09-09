import { describe, expect, it } from 'vitest';
import { applySell } from '../../../src/lib/engine/actions/sell.js';
import type { SellAction } from '../../../src/lib/engine/action-types.js';
import { anyCard, makePlayer, stateWithHand, tile, withMerchant, withTile } from '../../helpers/fixtures.js';

function sellAction(sales: SellAction['sales']): SellAction {
  return { type: 'sell', player: 'p1', card: anyCard(), sales };
}

describe('applySell', () => {
  it('sells a cotton mill connected to a matching merchant, flipping it and consuming beer from own brewery', () => {
    const action = sellAction([
      {
        locationId: 'worcester',
        slotIndex: 0,
        beerSources: [{ kind: 'brewery', locationId: 'nuneaton', slotIndex: 0 }],
      },
    ]);
    let state = stateWithHand('p1', [action.card], {
      links: [{ slotId: 'worcester__gloucester', owner: 'p1', kind: 'canal' }],
    });
    state = {
      ...state,
      locations: withMerchant(
        withTile(
          withTile(state.locations, 'worcester', 0, tile('p1', 'cotton', 1, 0)),
          'nuneaton',
          0,
          tile('p1', 'brewery', 1, 1),
        ),
        'gloucester',
        0,
        'cotton',
      ),
    };
    const result = applySell(state, action);
    const worcester = result.locations['worcester'];
    if (worcester === undefined || worcester.kind === 'market') throw new Error('unreachable');
    expect(worcester.slots[0]?.tile).toMatchObject({ flipped: true });
    // +1 from the cotton mill sale, +1 from the brewery flipping (its last beer consumed).
    expect(result.players['p1']?.incomeTrackPosition).toBe(12);
  });

  it('rejects selling a tile the player does not own', () => {
    const action = sellAction([{ locationId: 'worcester', slotIndex: 0, beerSources: [] }]);
    let state = stateWithHand('p1', [action.card], {
      links: [{ slotId: 'worcester__gloucester', owner: 'p1', kind: 'canal' }],
    });
    state = {
      ...state,
      locations: withMerchant(
        withTile(state.locations, 'worcester', 0, tile('p2', 'cotton', 1, 0)),
        'gloucester',
        0,
        'cotton',
      ),
    };
    expect(() => applySell(state, action)).toThrow(/do not own/);
  });

  it('rejects selling without a connected merchant for that industry', () => {
    const action = sellAction([
      {
        locationId: 'coventry',
        slotIndex: 0,
        beerSources: [{ kind: 'brewery', locationId: 'nuneaton', slotIndex: 0 }],
      },
    ]);
    let state = stateWithHand('p1', [action.card]);
    state = {
      ...state,
      locations: withTile(
        withTile(state.locations, 'coventry', 0, tile('p1', 'cotton', 1, 0)),
        'nuneaton',
        0,
        tile('p1', 'brewery', 1, 1),
      ),
    };
    expect(() => applySell(state, action)).toThrow(/not connected/);
  });

  it('rejects selling an already-flipped tile', () => {
    const action = sellAction([{ locationId: 'worcester', slotIndex: 0, beerSources: [] }]);
    let state = stateWithHand('p1', [action.card], {
      links: [{ slotId: 'worcester__gloucester', owner: 'p1', kind: 'canal' }],
    });
    state = {
      ...state,
      locations: withMerchant(
        withTile(state.locations, 'worcester', 0, tile('p1', 'cotton', 1, 0, true)),
        'gloucester',
        0,
        'cotton',
      ),
    };
    expect(() => applySell(state, action)).toThrow(/already sold/);
  });

  it('rejects the wrong number of beer sources for the tile', () => {
    const action = sellAction([{ locationId: 'worcester', slotIndex: 0, beerSources: [] }]);
    let state = stateWithHand('p1', [action.card], {
      links: [{ slotId: 'worcester__gloucester', owner: 'p1', kind: 'canal' }],
    });
    state = {
      ...state,
      locations: withMerchant(
        withTile(state.locations, 'worcester', 0, tile('p1', 'cotton', 1, 0)),
        'gloucester',
        0,
        'cotton',
      ),
    };
    expect(() => applySell(state, action)).toThrow(/requires exactly 1 beer/);
  });

  it('consumes merchant beer and applies the money bonus at Warrington', () => {
    const action = sellAction([
      {
        locationId: 'stoke_on_trent',
        slotIndex: 0,
        beerSources: [
          { kind: 'merchant', marketId: 'warrington', merchantSlotIndex: 0, developChoice: null },
        ],
      },
    ]);
    let state = stateWithHand('p1', [action.card], {
      links: [{ slotId: 'warrington__stoke_on_trent', owner: 'p1', kind: 'canal' }],
    });
    state = {
      ...state,
      locations: withMerchant(
        withTile(state.locations, 'stoke_on_trent', 0, tile('p1', 'cotton', 1, 0)),
        'warrington',
        0,
        'wild',
      ),
    };
    const result = applySell(state, action);
    expect(result.players['p1']?.money).toBe(30 + 5);
    const warrington = result.locations['warrington'];
    if (warrington === undefined || warrington.kind !== 'market') throw new Error('unreachable');
    expect(warrington.merchantSlots[0]?.hasBeer).toBe(false);
  });

  it('applies the Gloucester develop bonus, removing a free tile of the chosen industry', () => {
    const action = sellAction([
      {
        locationId: 'worcester',
        slotIndex: 0,
        beerSources: [
          {
            kind: 'merchant',
            marketId: 'gloucester',
            merchantSlotIndex: 0,
            developChoice: 'manufacturer',
          },
        ],
      },
    ]);
    let state = stateWithHand('p1', [action.card], {
      links: [{ slotId: 'worcester__gloucester', owner: 'p1', kind: 'canal' }],
    });
    state = {
      ...state,
      locations: withMerchant(
        withTile(state.locations, 'worcester', 0, tile('p1', 'manufacturer', 1, 0)),
        'gloucester',
        0,
        'wild',
      ),
    };
    const manufacturerBefore = state.players['p1']!.industryStock.manufacturer;
    const result = applySell(state, action);
    expect(result.players['p1']?.industryStock.manufacturer).toEqual(manufacturerBefore.slice(1));
  });

  it('sells multiple tiles in one action', () => {
    const action = sellAction([
      {
        locationId: 'worcester',
        slotIndex: 0,
        beerSources: [{ kind: 'brewery', locationId: 'nuneaton', slotIndex: 0 }],
      },
      {
        locationId: 'worcester',
        slotIndex: 1,
        beerSources: [{ kind: 'brewery', locationId: 'nuneaton', slotIndex: 0 }],
      },
    ]);
    let state = stateWithHand('p1', [action.card], {
      links: [{ slotId: 'worcester__gloucester', owner: 'p1', kind: 'canal' }],
    });
    state = {
      ...state,
      players: {
        ...state.players,
        p1: makePlayer('p1', { hand: [action.card] }),
      },
      locations: withMerchant(
        withTile(
          withTile(
            withTile(state.locations, 'worcester', 0, tile('p1', 'cotton', 1, 0)),
            'worcester',
            1,
            tile('p1', 'cotton', 1, 0),
          ),
          'nuneaton',
          0,
          tile('p1', 'brewery', 1, 2),
        ),
        'gloucester',
        0,
        'wild',
      ),
    };
    const result = applySell(state, action);
    const worcester = result.locations['worcester'];
    if (worcester === undefined || worcester.kind === 'market') throw new Error('unreachable');
    expect(worcester.slots[0]?.tile?.flipped).toBe(true);
    expect(worcester.slots[1]?.tile?.flipped).toBe(true);
  });
});
