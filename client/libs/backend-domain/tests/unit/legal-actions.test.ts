import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../src/lib/core/state.js';
import { legalActions } from '../../src/lib/engine/legal/index.js';
import { applyBuild } from '../../src/lib/engine/actions/build.js';
import { applyNetworkAction } from '../../src/lib/engine/actions/network-action.js';
import { applyDevelop } from '../../src/lib/engine/actions/develop.js';
import { applySell } from '../../src/lib/engine/actions/sell.js';
import { applyLoan } from '../../src/lib/engine/actions/loan.js';
import { applyScout } from '../../src/lib/engine/actions/scout.js';
import type { Action } from '../../src/lib/engine/action-types.js';
import type { GameState } from '../../src/lib/core/types.js';
import { emptyLocations, makePlayer, makeState, tile, withMerchant, withTile } from '../helpers/fixtures.js';

function applyDirectly(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'build':
      return applyBuild(state, action);
    case 'network':
      return applyNetworkAction(state, action);
    case 'develop':
      return applyDevelop(state, action);
    case 'sell':
      return applySell(state, action);
    case 'loan':
      return applyLoan(state, action);
    case 'scout':
      return applyScout(state, action);
    case 'pass':
      return state; // pass is trivially applicable given a card in hand
  }
}

function assertNoDuplicates(actions: Action[]): void {
  const keys = actions.map((a) => JSON.stringify(canonicalize(a)));
  expect(new Set(keys).size).toBe(keys.length);
}

function assertAllApplicable(state: GameState, actions: Action[]): void {
  for (const action of actions) {
    expect(() => applyDirectly(state, action)).not.toThrow();
  }
}

describe('legalActions', () => {
  it('returns no duplicate actions on the fresh initial-ish state', () => {
    const state = makeState({
      players: {
        p1: makePlayer('p1', {
          hand: [
            { kind: 'location', locationId: 'birmingham' },
            { kind: 'location', locationId: 'birmingham' }, // duplicate card value
            { kind: 'industry', industry: 'coal' },
            { kind: 'industry', industry: 'coal' }, // duplicate card value
          ],
        }),
        p2: makePlayer('p2'),
      },
    });
    const actions = legalActions(state, 'p1');
    assertNoDuplicates(actions);
  });

  it('every returned action is actually applicable without error', () => {
    const state = makeState({
      players: {
        p1: makePlayer('p1', {
          hand: [
            { kind: 'location', locationId: 'birmingham' },
            { kind: 'location', locationId: 'wolverhampton' },
            { kind: 'industry', industry: 'coal' },
            { kind: 'industry', industry: 'iron' },
            { kind: 'wildLocation' },
            { kind: 'wildIndustry' },
          ],
        }),
        p2: makePlayer('p2'),
      },
    });
    const actions = legalActions(state, 'p1');
    expect(actions.length).toBeGreaterThan(0);
    assertAllApplicable(state, actions);
  });

  it('includes build, network, develop, loan, scout, and pass on a fresh state', () => {
    const state = makeState({
      wildLocationCards: 2,
      wildIndustryCards: 2,
      players: {
        p1: makePlayer('p1', {
          hand: [
            { kind: 'location', locationId: 'birmingham' },
            { kind: 'industry', industry: 'coal' },
            { kind: 'wildLocation' },
            { kind: 'wildIndustry' },
          ],
        }),
        p2: makePlayer('p2'),
      },
    });
    const types = new Set(legalActions(state, 'p1').map((a) => a.type));
    expect(types).toEqual(new Set(['build', 'network', 'develop', 'loan', 'scout', 'pass']));
  });

  it('a hand-built legal Sell action is present in the generated list', () => {
    const action = {
      type: 'sell' as const,
      player: 'p1',
      card: { kind: 'industry' as const, industry: 'coal' as const },
      sales: [
        {
          locationId: 'worcester',
          slotIndex: 0,
          beerSources: [{ kind: 'brewery' as const, locationId: 'nuneaton', slotIndex: 0 }],
        },
      ],
    };
    let state = makeState({
      links: [{ slotId: 'worcester__gloucester', owner: 'p1', kind: 'canal' }],
      players: {
        p1: makePlayer('p1', { hand: [action.card] }),
        p2: makePlayer('p2'),
      },
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
    const actions = legalActions(state, 'p1');
    const keys = new Set(actions.map((a) => JSON.stringify(canonicalize(a))));
    expect(keys.has(JSON.stringify(canonicalize(action)))).toBe(true);
  });

  it('a hand-built legal Build action (single-icon slot, no resource cost) is present', () => {
    const action = {
      type: 'build' as const,
      player: 'p1',
      card: { kind: 'location' as const, locationId: 'dudley' },
      locationId: 'dudley',
      slotIndex: 0,
      industry: 'coal' as const,
      coalSource: null,
      ironSource: null,
    };
    const state = makeState({
      players: {
        p1: makePlayer('p1', { hand: [action.card] }),
        p2: makePlayer('p2'),
      },
    });
    const actions = legalActions(state, 'p1');
    const keys = new Set(actions.map((a) => JSON.stringify(canonicalize(a))));
    expect(keys.has(JSON.stringify(canonicalize(action)))).toBe(true);
  });

  it('returns an empty list for a player with an empty hand', () => {
    const state = makeState({
      players: { p1: makePlayer('p1', { hand: [] }), p2: makePlayer('p2') },
    });
    expect(legalActions(state, 'p1')).toEqual([]);
  });

  it('returns an empty list for an unknown player', () => {
    const state = makeState();
    expect(legalActions(state, 'nobody')).toEqual([]);
  });

  it('offers every mine tied for nearest as a separate Build candidate, not one collapsed to a canonical pick', () => {
    // birmingham is directly linked to both walsall and dudley (distance 1 each) — a real tie,
    // per docs/RULES.md §6.1 rule 1 ("em empate, escolha livre"). docs/ASSUMPTIONS.md #11 used
    // to collapse this to one canonical mine; the player should see both as choices instead.
    const locations = withTile(withTile(emptyLocations(), 'walsall', 0, tile('p2', 'coal', 1, 2)), 'dudley', 0, tile('p2', 'coal', 1, 2));
    const state = makeState({
      links: [
        { slotId: 'walsall__birmingham', owner: 'p1', kind: 'canal' },
        { slotId: 'dudley__birmingham', owner: 'p1', kind: 'canal' },
      ],
      locations,
      players: {
        p1: makePlayer('p1', { hand: [{ kind: 'industry', industry: 'cotton' }] }),
        p2: makePlayer('p2'),
      },
    });

    const cottonBuilds = legalActions(state, 'p1').filter(
      (a): a is Extract<Action, { type: 'build' }> => a.type === 'build' && a.industry === 'cotton',
    );
    const coalSources = new Set(cottonBuilds.map((a) => (a.coalSource?.kind === 'mine' ? a.coalSource.locationId : a.coalSource?.kind)));
    expect(coalSources).toEqual(new Set(['walsall', 'dudley']));
  });

  it('offers only the actual nearest mine when distances are not tied', () => {
    // dudley is directly linked to birmingham (distance 1); walsall is only reachable the long
    // way, via dudley and wolverhampton (distance 3) — no tie, so only dudley's mine (the
    // genuinely nearest one) should be offered.
    const locations = withTile(withTile(emptyLocations(), 'walsall', 0, tile('p2', 'coal', 1, 2)), 'dudley', 0, tile('p2', 'coal', 1, 2));
    const state = makeState({
      links: [
        { slotId: 'dudley__birmingham', owner: 'p1', kind: 'canal' },
        { slotId: 'wolverhampton__dudley', owner: 'p1', kind: 'canal' },
        { slotId: 'wolverhampton__walsall', owner: 'p1', kind: 'canal' },
      ],
      locations,
      players: {
        p1: makePlayer('p1', { hand: [{ kind: 'industry', industry: 'cotton' }] }),
        p2: makePlayer('p2'),
      },
    });

    const cottonBuilds = legalActions(state, 'p1').filter(
      (a): a is Extract<Action, { type: 'build' }> => a.type === 'build' && a.industry === 'cotton',
    );
    const coalSources = new Set(cottonBuilds.map((a) => (a.coalSource?.kind === 'mine' ? a.coalSource.locationId : a.coalSource?.kind)));
    expect(coalSources).toEqual(new Set(['dudley']));
  });
});
