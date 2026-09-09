import { describe, expect, it } from 'vitest';
import { applyDevelop } from '../../../src/engine/actions/develop.js';
import type { DevelopAction } from '../../../src/engine/action-types.js';
import { anyCard, makePlayer, stateWithHand, tile, withTile } from '../../helpers/fixtures.js';

function developAction(
  industries: DevelopAction['industries'],
  ironSources: DevelopAction['ironSources'],
): DevelopAction {
  return { type: 'develop', player: 'p1', card: anyCard(), industries, ironSources };
}

describe('applyDevelop', () => {
  it('removes the lowest-level tile of the chosen industry, consuming iron from an iron works for free', () => {
    const action = developAction(['cotton'], [{ kind: 'works', locationId: 'birmingham', slotIndex: 0 }]);
    let state = stateWithHand('p1', [action.card]);
    const cottonBefore = state.players['p1']!.industryStock.cotton;
    state = { ...state, locations: withTile(state.locations, 'birmingham', 0, tile('p2', 'iron', 2, 3)) };
    const result = applyDevelop(state, action);
    expect(result.players['p1']?.industryStock.cotton).toEqual(cottonBefore.slice(1));
    expect(result.players['p1']?.money).toBe(30); // free: iron came from an unflipped works
    const birmingham = result.locations['birmingham'];
    if (birmingham === undefined || birmingham.kind === 'market') throw new Error('unreachable');
    expect(birmingham.slots[0]?.tile?.resourceRemaining).toBe(2);
  });

  it('removes 2 tiles in one action, consuming 1 iron each', () => {
    const action = developAction(
      ['cotton', 'manufacturer'],
      [
        { kind: 'works', locationId: 'birmingham', slotIndex: 0 },
        { kind: 'works', locationId: 'birmingham', slotIndex: 0 },
      ],
    );
    let state = stateWithHand('p1', [action.card]);
    const cottonBefore = state.players['p1']!.industryStock.cotton;
    const manufacturerBefore = state.players['p1']!.industryStock.manufacturer;
    state = { ...state, locations: withTile(state.locations, 'birmingham', 0, tile('p2', 'iron', 3, 4)) };
    const result = applyDevelop(state, action);
    expect(result.players['p1']?.industryStock.cotton).toEqual(cottonBefore.slice(1));
    expect(result.players['p1']?.industryStock.manufacturer).toEqual(manufacturerBefore.slice(1));
    const birmingham = result.locations['birmingham'];
    if (birmingham === undefined || birmingham.kind === 'market') throw new Error('unreachable');
    expect(birmingham.slots[0]?.tile?.resourceRemaining).toBe(2);
  });

  it('rejects a mismatched number of iron sources', () => {
    const action = developAction(
      ['cotton', 'manufacturer'],
      [{ kind: 'works', locationId: 'birmingham', slotIndex: 0 }],
    );
    const state = stateWithHand('p1', [action.card]);
    expect(() => applyDevelop(state, action)).toThrow(/exactly 1 iron source/);
  });

  it('buys iron from the market and pays for it when no iron works exists', () => {
    const action = developAction(['cotton'], [{ kind: 'market' }]);
    const state = stateWithHand('p1', [action.card]);
    const result = applyDevelop(state, action);
    expect(result.players['p1']?.money).toBe(30 - 2); // iron market at 8/10 cubes costs £2
    expect(result.market.ironCubes).toBe(7);
  });

  it('can remove the locked pottery level-1 tile (Develop is exempt from the Build lock)', () => {
    const action = developAction(['pottery'], [{ kind: 'market' }]);
    const state = stateWithHand('p1', [action.card]);
    const result = applyDevelop(state, action);
    expect(result.players['p1']?.industryStock.pottery).toEqual([2, 2, 3, 3, 4, 4]);
  });

  it('throws when the player has no tiles left in that industry', () => {
    const action = developAction(['cotton'], [{ kind: 'market' }]);
    const state = stateWithHand('p1', [action.card], {
      players: {
        p1: makePlayer('p1', {
          hand: [action.card],
          industryStock: { ...makePlayer('p1').industryStock, cotton: [] },
        }),
        p2: makePlayer('p2'),
      },
    });
    expect(() => applyDevelop(state, action)).toThrow(/no cotton tiles left/);
  });
});
