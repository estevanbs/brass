import { describe, expect, it } from 'vitest';
import { scoreEra, scoreIndustries, scoreLinks } from '../../src/engine/scoring.js';
import { makeState, tile, withTile } from '../helpers/fixtures.js';

describe('scoreLinks', () => {
  it('scores 2 VP for each end of a link that touches a market', () => {
    const state = makeState({
      links: [{ slotId: 'warrington__wolverhampton', owner: 'p1', kind: 'canal' }],
    });
    const result = scoreLinks(state);
    expect(result.players['p1']?.victoryPoints).toBe(2);
    expect(result.links).toEqual([]);
  });

  it('scores the VP of every flipped industry tile at each non-market end, any owner', () => {
    let state = makeState({
      links: [{ slotId: 'birmingham__wolverhampton', owner: 'p1', kind: 'canal' }],
    });
    state = {
      ...state,
      locations: withTile(
        withTile(state.locations, 'birmingham', 0, tile('p2', 'iron', 2, 0, true)),
        'wolverhampton',
        0,
        tile('p1', 'coal', 3, 0, true),
      ),
    };
    const result = scoreLinks(state);
    // link owner (p1) gets both tiles' VP, regardless of who owns each tile.
    expect(result.players['p1']?.victoryPoints).toBe(3 /* iron L2 */ + 3 /* coal L3 */);
    expect(result.players['p2']?.victoryPoints).toBe(0);
  });

  it('does not score unflipped tiles', () => {
    let state = makeState({
      links: [{ slotId: 'birmingham__wolverhampton', owner: 'p1', kind: 'canal' }],
    });
    state = { ...state, locations: withTile(state.locations, 'birmingham', 0, tile('p1', 'iron', 2, 3, false)) };
    const result = scoreLinks(state);
    expect(result.players['p1']?.victoryPoints).toBe(0);
  });

  it('the kidderminster-worcester link also scores farm_brewery_south', () => {
    let state = makeState({
      links: [{ slotId: 'kidderminster__worcester', owner: 'p1', kind: 'canal' }],
    });
    state = {
      ...state,
      locations: withTile(state.locations, 'farm_brewery_south', 0, tile('p1', 'brewery', 2, 0, true)),
    };
    const result = scoreLinks(state);
    expect(result.players['p1']?.victoryPoints).toBe(5); // brewery L2 VP
  });
});

describe('scoreIndustries', () => {
  it('scores every flipped tile to its own owner', () => {
    let state = makeState();
    state = {
      ...state,
      locations: withTile(
        withTile(state.locations, 'birmingham', 0, tile('p1', 'iron', 4, 0, true)),
        'wolverhampton',
        0,
        tile('p2', 'coal', 1, 0, true),
      ),
    };
    const result = scoreIndustries(state);
    expect(result.players['p1']?.victoryPoints).toBe(5); // iron L4
    expect(result.players['p2']?.victoryPoints).toBe(1); // coal L1
  });
});

describe('scoreEra', () => {
  it('scores links first (removing them) and then industries, in one call', () => {
    let state = makeState({
      links: [{ slotId: 'birmingham__wolverhampton', owner: 'p1', kind: 'canal' }],
    });
    state = { ...state, locations: withTile(state.locations, 'birmingham', 0, tile('p1', 'iron', 1, 0, true)) };
    const result = scoreEra(state);
    // link scoring (+2 for iron L1) and industry scoring (+2 for iron L1) both apply.
    expect(result.players['p1']?.victoryPoints).toBe(4);
    expect(result.links).toEqual([]);
  });
});
