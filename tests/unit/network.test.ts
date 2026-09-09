import { describe, expect, it } from 'vitest';
import {
  areConnected,
  isConnectedToCoalMerchant,
  isInNetwork,
  locationsInNetwork,
} from '../../src/engine/network.js';
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
      links: [{ slotId: 'birmingham__wolverhampton', owner: 'p1', kind: 'canal' }],
    });
    expect(isInNetwork(state, 'p1', 'birmingham')).toBe(true);
    expect(isInNetwork(state, 'p1', 'wolverhampton')).toBe(true);
    expect(locationsInNetwork(state, 'p1')).toEqual(new Set(['birmingham', 'wolverhampton']));
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
        { slotId: 'birmingham__wolverhampton', owner: 'p1', kind: 'canal' },
        { slotId: 'wolverhampton__dudley', owner: 'p2', kind: 'canal' },
      ],
    });
    expect(areConnected(state, 'birmingham', 'dudley')).toBe(true);
    expect(areConnected(state, 'birmingham', 'coventry')).toBe(false);
  });

  it('isConnectedToCoalMerchant is true for any of the 5 named merchants, tile or no tile', () => {
    const state = makeState({
      links: [{ slotId: 'warrington__wolverhampton', owner: 'p1', kind: 'canal' }],
    });
    expect(isConnectedToCoalMerchant(state, 'wolverhampton')).toBe(true);
    expect(isConnectedToCoalMerchant(state, 'birmingham')).toBe(false);
  });
});
