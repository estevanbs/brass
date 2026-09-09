import { describe, expect, it } from 'vitest';
import {
  findConnectedCoalMines,
  noResourceCubesAnywhere,
  validateCoalSource,
  validateIronSource,
} from '../../src/engine/resources.js';
import { makeState, tile, withTile } from '../helpers/fixtures.js';

describe('validateCoalSource', () => {
  it('requires the closest connected unflipped mine when one exists', () => {
    let state = makeState({
      links: [
        { slotId: 'birmingham__wolverhampton', owner: 'p1', kind: 'canal' },
        { slotId: 'wolverhampton__dudley', owner: 'p1', kind: 'canal' },
      ],
    });
    state = {
      ...state,
      locations: withTile(
        withTile(state.locations, 'wolverhampton', 0, tile('p1', 'coal', 1, 2)),
        'dudley',
        0,
        tile('p2', 'coal', 2, 3),
      ),
    };
    // From birmingham, wolverhampton (distance 1) is closer than dudley (distance 2).
    expect(() =>
      validateCoalSource(state, 'birmingham', { kind: 'mine', locationId: 'dudley', slotIndex: 0 }),
    ).toThrow(/closest/);
    expect(() =>
      validateCoalSource(state, 'birmingham', { kind: 'mine', locationId: 'wolverhampton', slotIndex: 0 }),
    ).not.toThrow();
  });

  it('rejects the market when a connected mine exists', () => {
    let state = makeState();
    state = { ...state, locations: withTile(state.locations, 'birmingham', 0, tile('p1', 'coal', 1, 2)) };
    // birmingham has no coal slot in board-data, but the fixture lets us place any tile for
    // the purposes of this unit test; distance 0 from itself.
    expect(() => validateCoalSource(state, 'birmingham', { kind: 'market' })).toThrow(
      /coal cannot be bought from the market/,
    );
  });

  it('falls back to the market only when connected to a merchant', () => {
    const state = makeState();
    expect(() => validateCoalSource(state, 'birmingham', { kind: 'market' })).toThrow(/not connected/);
  });

  it('findConnectedCoalMines ignores flipped or empty mines', () => {
    let state = makeState({
      links: [{ slotId: 'birmingham__wolverhampton', owner: 'p1', kind: 'canal' }],
    });
    state = { ...state, locations: withTile(state.locations, 'wolverhampton', 0, tile('p1', 'coal', 1, 0, true)) };
    expect(findConnectedCoalMines(state, 'birmingham')).toEqual([]);
  });
});

describe('validateIronSource', () => {
  it('requires an iron works when one exists anywhere on the board (no connectivity needed)', () => {
    let state = makeState();
    state = { ...state, locations: withTile(state.locations, 'stourbridge', 1, tile('p2', 'iron', 1, 2)) };
    expect(() => validateIronSource(state, { kind: 'market' })).toThrow(
      /iron cannot be bought from the market/,
    );
    expect(() =>
      validateIronSource(state, { kind: 'works', locationId: 'stourbridge', slotIndex: 1 }),
    ).not.toThrow();
  });

  it('allows the market once no iron works exist', () => {
    const state = makeState();
    expect(() => validateIronSource(state, { kind: 'market' })).not.toThrow();
  });
});

describe('noResourceCubesAnywhere', () => {
  it('is false while the market has cubes', () => {
    const state = makeState({ market: { coalCubes: 1, ironCubes: 0 } });
    expect(noResourceCubesAnywhere(state, 'coal')).toBe(false);
  });

  it('is false while any unflipped tile still holds that resource', () => {
    let state = makeState({ market: { coalCubes: 0, ironCubes: 0 } });
    state = { ...state, locations: withTile(state.locations, 'wolverhampton', 0, tile('p1', 'coal', 1, 1)) };
    expect(noResourceCubesAnywhere(state, 'coal')).toBe(false);
  });

  it('is true once the market and every tile are empty', () => {
    let state = makeState({ market: { coalCubes: 0, ironCubes: 0 } });
    state = { ...state, locations: withTile(state.locations, 'wolverhampton', 0, tile('p1', 'coal', 1, 0, true)) };
    expect(noResourceCubesAnywhere(state, 'coal')).toBe(true);
  });
});
