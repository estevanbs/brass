import { describe, expect, it } from 'vitest';
import { applyNetworkAction } from '../../../src/engine/actions/network-action.js';
import type { NetworkAction } from '../../../src/engine/action-types.js';
import { anyCard, stateWithHand, tile, withTile } from '../../helpers/fixtures.js';

function networkAction(overrides: Partial<NetworkAction> = {}): NetworkAction {
  return {
    type: 'network',
    player: 'p1',
    card: anyCard(),
    linkSlotIds: ['birmingham__wolverhampton'],
    coalSources: [],
    beerSource: null,
    ...overrides,
  };
}

describe('applyNetworkAction', () => {
  it('builds a single canal link for £3 with no resource consumption', () => {
    const action = networkAction();
    const state = stateWithHand('p1', [action.card]);
    const result = applyNetworkAction(state, action);
    expect(result.players['p1']?.money).toBe(30 - 3);
    expect(result.players['p1']?.linkTilesRemaining).toBe(13);
    expect(result.links).toEqual([{ slotId: 'birmingham__wolverhampton', owner: 'p1', kind: 'canal' }]);
  });

  it('rejects building on an already-occupied link slot', () => {
    const action = networkAction();
    const state = stateWithHand('p1', [action.card], {
      links: [{ slotId: 'birmingham__wolverhampton', owner: 'p2', kind: 'canal' }],
    });
    expect(() => applyNetworkAction(state, action)).toThrow(/already built/);
  });

  it('requires adjacency to the network unless the player has nothing on the board', () => {
    const action = networkAction({ linkSlotIds: ['coventry__redditch'] });
    let state = stateWithHand('p1', [action.card]);
    state = { ...state, locations: withTile(state.locations, 'birmingham', 0, tile('p1', 'iron', 1, 2)) };
    expect(() => applyNetworkAction(state, action)).toThrow(/not adjacent/);
  });

  it('allows any link when the player has no tiles or links on the board', () => {
    const action = networkAction({ linkSlotIds: ['coventry__redditch'] });
    const state = stateWithHand('p1', [action.card]);
    expect(() => applyNetworkAction(state, action)).not.toThrow();
  });

  it('rejects a canal link in the rail era, and vice versa for a double-rail action', () => {
    const doubleAction = networkAction({
      linkSlotIds: ['birmingham__wolverhampton', 'birmingham__dudley'],
    });
    const state = stateWithHand('p1', [doubleAction.card]);
    expect(() => applyNetworkAction(state, doubleAction)).toThrow(/rail era/);
  });

  it('builds a single rail link for £5 + 1 coal, sourced from the market when no mine is connected', () => {
    const action = networkAction({
      linkSlotIds: ['oxford__coventry'],
      coalSources: [{ kind: 'market' }],
    });
    const state = stateWithHand('p1', [action.card], { era: 'rail' });
    const result = applyNetworkAction(state, action);
    // £5 + £1 (coal market at 13/14 cubes, connected via the very link just placed to Oxford).
    expect(result.players['p1']?.money).toBe(30 - 5 - 1);
    expect(result.market.coalCubes).toBe(12);
  });

  it('rejects a single rail link with no coal source', () => {
    const action = networkAction({ linkSlotIds: ['oxford__coventry'], coalSources: [] });
    const state = stateWithHand('p1', [action.card], { era: 'rail' });
    expect(() => applyNetworkAction(state, action)).toThrow(/one coal source/);
  });

  it('builds 2 rail links for £15 + 1 beer + 2 coal', () => {
    const action = networkAction({
      linkSlotIds: ['oxford__coventry', 'coventry__redditch'],
      coalSources: [{ kind: 'market' }, { kind: 'market' }],
      beerSource: { kind: 'brewery', locationId: 'coventry', slotIndex: 0 },
    });
    let state = stateWithHand('p1', [action.card], { era: 'rail' });
    state = {
      ...state,
      locations: withTile(state.locations, 'coventry', 0, tile('p1', 'brewery', 1, 1)),
    };
    const result = applyNetworkAction(state, action);
    // £15 + first coal at 13/14 cubes (£1) + second coal at 12/14 cubes (£2); beer is free.
    expect(result.players['p1']?.money).toBe(30 - 15 - 1 - 2);
    expect(result.links).toHaveLength(2);
    expect(result.players['p1']?.linkTilesRemaining).toBe(12);
  });

  it('rejects merchant beer for the double rail-link action', () => {
    const action = networkAction({
      linkSlotIds: ['birmingham__wolverhampton', 'birmingham__dudley'],
      coalSources: [{ kind: 'market' }, { kind: 'market' }],
      beerSource: { kind: 'merchant', marketId: 'warrington', merchantSlotIndex: 0, developChoice: null },
    });
    const state = stateWithHand('p1', [action.card], { era: 'rail' });
    expect(() => applyNetworkAction(state, action)).toThrow(/cannot come from a merchant/);
  });

  it('rejects insufficient remaining link tiles', () => {
    const action = networkAction();
    const state = stateWithHand('p1', [action.card]);
    const withZeroLinks = {
      ...state,
      players: { ...state.players, p1: { ...state.players['p1']!, linkTilesRemaining: 0 } },
    };
    expect(() => applyNetworkAction(withZeroLinks, action)).toThrow(/does not have enough link tiles/);
  });
});
