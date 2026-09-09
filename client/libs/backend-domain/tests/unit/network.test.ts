import { describe, expect, it } from 'vitest';
import {
  areConnected,
  isConnectedToCoalMerchant,
  isInNetwork,
  locationsInNetwork,
} from '../../src/lib/engine/network.js';
import { makeState, tile, withTile } from '../helpers/fixtures.js';

describe('network helpers', () => {
  it('a location with your own tile is part of your network', () => {
    let state = makeState();
    state = { ...state, locations: withTile(state.locations, 'birmingham', 0, tile('p1', 'iron', 1, 2)) };
    expect(isInNetwork(state, 'p1', 'birmingham')).toBe(true);
    expect(isInNetwork(state, 'p2', 'birmingham')).toBe(false);
  });

  it('an endpoint of your own link is part of your network, even with no tile there', () => {
    const state = makeState({
      links: [{ slotId: 'walsall__birmingham', owner: 'p1', kind: 'canal' }],
    });
    expect(isInNetwork(state, 'p1', 'walsall')).toBe(true);
    expect(isInNetwork(state, 'p1', 'birmingham')).toBe(true);
    expect(locationsInNetwork(state, 'p1')).toEqual(new Set(['walsall', 'birmingham']));
  });

  it('the kidderminster-worcester link also brings farm_brewery_south into the network', () => {
    const state = makeState({
      links: [{ slotId: 'kidderminster__worcester', owner: 'p1', kind: 'canal' }],
    });
    expect(locationsInNetwork(state, 'p1')).toEqual(
      new Set(['kidderminster', 'worcester', 'farm_brewery_south']),
    );
  });

  it('areConnected uses the full built-link graph regardless of ownership', () => {
    const state = makeState({
      links: [
        { slotId: 'walsall__birmingham', owner: 'p1', kind: 'canal' },
        { slotId: 'dudley__birmingham', owner: 'p2', kind: 'rail' },
      ],
    });
    expect(areConnected(state, 'walsall', 'dudley')).toBe(true);
    expect(areConnected(state, 'walsall', 'coventry')).toBe(false);
  });

  it('isConnectedToCoalMerchant is true for any of the 5 named merchants, tile or no tile', () => {
    const state = makeState({
      links: [{ slotId: 'warrington__stoke_on_trent', owner: 'p1', kind: 'canal' }],
    });
    expect(isConnectedToCoalMerchant(state, 'stoke_on_trent')).toBe(true);
    expect(isConnectedToCoalMerchant(state, 'birmingham')).toBe(false);
  });
});
