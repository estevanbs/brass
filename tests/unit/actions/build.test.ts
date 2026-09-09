import { describe, expect, it } from 'vitest';
import { applyBuild } from '../../../src/engine/actions/build.js';
import type { BuildAction } from '../../../src/engine/action-types.js';
import type { Card, GameState } from '../../../src/core/types.js';
import { makePlayer, makeState, tile, withMerchant, withTile } from '../../helpers/fixtures.js';

function buildAction(overrides: Partial<BuildAction> = {}): BuildAction {
  return {
    type: 'build',
    player: 'p1',
    card: { kind: 'location', locationId: 'wolverhampton' },
    locationId: 'wolverhampton',
    slotIndex: 0,
    industry: 'coal',
    coalSource: null,
    ironSource: null,
    ...overrides,
  };
}

/** A state whose p1 hand contains exactly `card`, so it can legally be discarded. */
function stateFor(card: Card, overrides: Partial<GameState> = {}): GameState {
  return makeState({
    players: {
      p1: makePlayer('p1', { hand: [card] }),
      p2: makePlayer('p2'),
    },
    ...overrides,
  });
}

describe('applyBuild', () => {
  it('builds a coal mine paying its cost, leaving coal on the tile when not connected to a merchant', () => {
    const action = buildAction();
    const state = stateFor(action.card);
    const result = applyBuild(state, action);
    expect(result.players['p1']?.money).toBe(30 - 5);
    const wolverhampton = result.locations['wolverhampton'];
    if (wolverhampton?.kind === 'market') throw new Error('unreachable');
    expect(wolverhampton?.slots[0]?.tile).toMatchObject({
      owner: 'p1',
      industry: 'coal',
      level: 1,
      flipped: false,
      resourceRemaining: 2,
    });
    expect(result.players['p1']?.industryStock.coal).toEqual([1, 1, 2, 2, 3, 3, 4]);
  });

  it('discards the card used and does not mutate the input state', () => {
    const action = buildAction();
    const state = stateFor(action.card);
    const before = JSON.stringify(state);
    const result = applyBuild(state, action);
    expect(JSON.stringify(state)).toBe(before);
    expect(result.players['p1']?.hand).toHaveLength(0);
    expect(result.players['p1']?.discardPile).toHaveLength(1);
  });

  it('auto-sells iron to the market immediately and unconditionally, flipping the tile if fully sold', () => {
    const action = buildAction({
      card: { kind: 'location', locationId: 'birmingham' },
      locationId: 'birmingham',
      slotIndex: 0,
      industry: 'iron',
    });
    const state = stateFor(action.card);
    const result = applyBuild(state, action);
    // cost £5, produces 2 iron sold at £1 each (market starts at 8/10 cubes) = +£2.
    expect(result.players['p1']?.money).toBe(30 - 5 + 2);
    expect(result.market.ironCubes).toBe(10);
    const birmingham = result.locations['birmingham'];
    if (birmingham?.kind === 'market') throw new Error('unreachable');
    expect(birmingham?.slots[0]?.tile).toMatchObject({ flipped: true, resourceRemaining: 0 });
    expect(result.players['p1']?.incomeTrackPosition).toBe(11); // level 1 iron income +1
  });

  it('sells as much coal as market capacity allows only when connected to a merchant, leaving the rest on the tile', () => {
    const action = buildAction();
    const state = stateFor(action.card, {
      links: [{ slotId: 'warrington__wolverhampton', owner: 'p1', kind: 'canal' }],
    });
    const result = applyBuild(state, action);
    // Market starts at 13/14 cubes: only 1 of the 2 produced coal units can be sold.
    expect(result.market.coalCubes).toBe(14);
    expect(result.players['p1']?.money).toBe(30 - 5 + 1);
    const wolverhampton = result.locations['wolverhampton'];
    if (wolverhampton?.kind === 'market') throw new Error('unreachable');
    expect(wolverhampton?.slots[0]?.tile).toMatchObject({ flipped: false, resourceRemaining: 1 });
  });

  it('fully sells and flips a coal mine when the market has room for all its production', () => {
    const action = buildAction();
    const state = stateFor(action.card, {
      market: { coalCubes: 8, ironCubes: 8 },
      links: [{ slotId: 'warrington__wolverhampton', owner: 'p1', kind: 'canal' }],
    });
    const result = applyBuild(state, action);
    expect(result.market.coalCubes).toBe(10);
    const wolverhampton = result.locations['wolverhampton'];
    if (wolverhampton?.kind === 'market') throw new Error('unreachable');
    expect(wolverhampton?.slots[0]?.tile).toMatchObject({ flipped: true, resourceRemaining: 0 });
    expect(result.players['p1']?.incomeTrackPosition).toBe(11); // level 1 coal income +1
  });

  it('rejects a location card that names a different location', () => {
    const action = buildAction({ card: { kind: 'location', locationId: 'birmingham' } });
    const state = stateFor(action.card);
    expect(() => applyBuild(state, action)).toThrow(/does not match/);
  });

  it('rejects building at a farm brewery with a location card', () => {
    const action = buildAction({
      card: { kind: 'location', locationId: 'farm_brewery_north' },
      locationId: 'farm_brewery_north',
      slotIndex: 0,
      industry: 'brewery',
    });
    const state = stateFor(action.card);
    expect(() => applyBuild(state, action)).toThrow(/farm brewer/i);
  });

  it('requires network membership when building with an industry card (no exception tiles present)', () => {
    const action = buildAction({
      card: { kind: 'industry', industry: 'coal' },
      locationId: 'wolverhampton',
      slotIndex: 0,
    });
    let state = stateFor(action.card);
    state = { ...state, locations: withTile(state.locations, 'dudley', 0, tile('p1', 'coal', 1, 2)) };
    expect(() => applyBuild(state, action)).toThrow(/network/);
  });

  it('allows building with an industry card anywhere when the player has no tiles or links on the board', () => {
    const action = buildAction({ card: { kind: 'industry', industry: 'coal' } });
    const state = stateFor(action.card);
    expect(() => applyBuild(state, action)).not.toThrow();
  });

  it('enforces the canal-era 1-tile-per-location limit', () => {
    const action = buildAction();
    let state = stateFor(action.card);
    state = { ...state, locations: withTile(state.locations, 'wolverhampton', 2, tile('p2', 'pottery', 1)) };
    expect(() => applyBuild(state, action)).toThrow(/canal era/);
  });

  it('requires using a single-industry slot over a shared slot when one is free', () => {
    const action = buildAction({
      card: { kind: 'location', locationId: 'dudley' },
      locationId: 'dudley',
      slotIndex: 1, // shared ['coal', 'iron'] slot; slot 0 (['coal'] only) is free
      industry: 'coal',
    });
    const state = stateFor(action.card);
    expect(() => applyBuild(state, action)).toThrow(/single-industry slot/);
  });

  it('rejects a slot that does not accept the chosen industry', () => {
    const action = buildAction({ industry: 'manufacturer' });
    const state = stateFor(action.card);
    expect(() => applyBuild(state, action)).toThrow(/does not accept/);
  });

  it('rejects building the locked pottery level-1 tile', () => {
    const action = buildAction({
      card: { kind: 'location', locationId: 'worcester' },
      locationId: 'worcester',
      slotIndex: 1,
      industry: 'pottery',
    });
    const state = stateFor(action.card);
    expect(() => applyBuild(state, action)).toThrow(/locked/);
  });

  it('allows overbuilding your own tile with a higher level of the same industry', () => {
    const action = buildAction();
    let state = stateFor(action.card, {
      players: {
        p1: makePlayer('p1', {
          hand: [action.card],
          industryStock: { ...makePlayer('p1').industryStock, coal: [2, 2, 3, 3, 4] },
        }),
        p2: makePlayer('p2'),
      },
    });
    state = { ...state, locations: withTile(state.locations, 'wolverhampton', 0, tile('p1', 'coal', 1, 0, true)) };
    const result = applyBuild(state, action);
    const wolverhampton = result.locations['wolverhampton'];
    if (wolverhampton?.kind === 'market') throw new Error('unreachable');
    expect(wolverhampton?.slots[0]?.tile).toMatchObject({ level: 2, flipped: false });
  });

  it("rejects overbuilding an opponent's coal mine while coal cubes remain on the board", () => {
    const action = buildAction();
    let state = stateFor(action.card);
    state = { ...state, locations: withTile(state.locations, 'wolverhampton', 0, tile('p2', 'coal', 1, 2)) };
    expect(() => applyBuild(state, action)).toThrow(/cubes of that resource remain/);
  });

  it("allows overbuilding an opponent's coal mine once no coal cubes remain anywhere", () => {
    const action = buildAction();
    let state = stateFor(action.card, { market: { coalCubes: 0, ironCubes: 8 } });
    state = {
      ...state,
      locations: withTile(state.locations, 'wolverhampton', 0, tile('p2', 'coal', 1, 0, true)),
    };
    const result = applyBuild(state, action);
    const wolverhampton = result.locations['wolverhampton'];
    if (wolverhampton?.kind === 'market') throw new Error('unreachable');
    expect(wolverhampton?.slots[0]?.tile?.owner).toBe('p1');
  });

  it('rejects an opponent overbuild of a non coal/iron industry', () => {
    const action = buildAction({
      card: { kind: 'location', locationId: 'coventry' },
      locationId: 'coventry',
      slotIndex: 0,
      industry: 'cotton',
    });
    let state = stateFor(action.card);
    state = { ...state, locations: withTile(state.locations, 'coventry', 0, tile('p2', 'cotton', 1, 0, true)) };
    expect(() => applyBuild(state, action)).toThrow(/coal mine or iron works/);
  });

  it('building a tile with no resource requirement never triggers an auto-sell', () => {
    const action = buildAction({
      card: { kind: 'location', locationId: 'coventry' },
      locationId: 'coventry',
      slotIndex: 0,
      industry: 'cotton',
      coalSource: { kind: 'market' },
    });
    const state = stateFor(action.card, {
      links: [{ slotId: 'oxford__coventry', owner: 'p1', kind: 'canal' }],
    });
    const result = applyBuild(state, action);
    const coventry = result.locations['coventry'];
    if (coventry?.kind === 'market') throw new Error('unreachable');
    expect(coventry?.slots[0]?.tile).toMatchObject({ flipped: false, resourceRemaining: 0 });
  });

  it('requires a coal source when the tile needs coal', () => {
    const action = buildAction({
      card: { kind: 'location', locationId: 'coventry' },
      locationId: 'coventry',
      slotIndex: 0,
      industry: 'cotton',
      coalSource: null,
    });
    const state = stateFor(action.card);
    expect(() => applyBuild(state, action)).toThrow(/requires coal/);
  });

  it('buys coal from the market and pays the price when no mine is connected', () => {
    const action = buildAction({
      card: { kind: 'location', locationId: 'coventry' },
      locationId: 'coventry',
      slotIndex: 0,
      industry: 'cotton',
      coalSource: { kind: 'market' },
    });
    const state = stateFor(action.card, {
      links: [{ slotId: 'oxford__coventry', owner: 'p1', kind: 'canal' }],
    });
    const result = applyBuild(state, action);
    // cost £12 (cotton L1) + £1 (coal market at 13/14 cubes) = £13.
    expect(result.players['p1']?.money).toBe(30 - 12 - 1);
    expect(result.market.coalCubes).toBe(12);
  });

  it('the withMerchant fixture helper sets both the icon and the beer barrel', () => {
    const locations = withMerchant(makeState().locations, 'warrington', 0, 'cotton');
    const warrington = locations['warrington'];
    if (warrington?.kind !== 'market') throw new Error('unreachable');
    expect(warrington.merchantSlots[0]).toEqual({ icon: 'cotton', hasBeer: true });
  });
});
