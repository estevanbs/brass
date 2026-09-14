import { describe, expect, it } from 'vitest';
import type { Action } from '@brass/backend-domain';
import { coalSourceLocationIds, ironSourceLocationIds } from '../../src/lib/game.service.js';

describe('coalSourceLocationIds / ironSourceLocationIds', () => {
  it('build: a mine source yields its own location, index-aligned in a single-entry array', () => {
    const action: Action = {
      type: 'build',
      player: 'p1',
      card: { kind: 'location', locationId: 'worcester' },
      locationId: 'worcester',
      slotIndex: 0,
      industry: 'cotton',
      coalSource: { kind: 'mine', locationId: 'dudley', slotIndex: 0 },
      ironSource: null,
    };
    expect(coalSourceLocationIds(action)).toEqual(['dudley']);
    expect(ironSourceLocationIds(action)).toEqual([]);
  });

  it('build: a market source is `null`, not a location — nothing on the map to click for it', () => {
    const action: Action = {
      type: 'build',
      player: 'p1',
      card: { kind: 'location', locationId: 'worcester' },
      locationId: 'worcester',
      slotIndex: 0,
      industry: 'cotton',
      coalSource: { kind: 'market' },
      ironSource: null,
    };
    expect(coalSourceLocationIds(action)).toEqual([null]);
  });

  it('build: needing neither resource yields empty arrays for both, not `[null]`', () => {
    const action: Action = {
      type: 'build',
      player: 'p1',
      card: { kind: 'location', locationId: 'dudley' },
      locationId: 'dudley',
      slotIndex: 0,
      industry: 'coal',
      coalSource: null,
      ironSource: null,
    };
    expect(coalSourceLocationIds(action)).toEqual([]);
    expect(ironSourceLocationIds(action)).toEqual([]);
  });

  it('build: an iron works source yields its own location', () => {
    const action: Action = {
      type: 'build',
      player: 'p1',
      card: { kind: 'location', locationId: 'birmingham' },
      locationId: 'birmingham',
      slotIndex: 1,
      industry: 'manufacturer',
      coalSource: null,
      ironSource: { kind: 'works', locationId: 'coventry', slotIndex: 2 },
    };
    expect(ironSourceLocationIds(action)).toEqual(['coventry']);
  });

  it('network: carries one coal-source entry per link, index-aligned with linkSlotIds, mixing a real mine and the market', () => {
    const action: Action = {
      type: 'network',
      player: 'p1',
      card: { kind: 'wildLocation' },
      linkSlotIds: ['walsall__birmingham', 'dudley__birmingham'],
      coalSources: [{ kind: 'mine', locationId: 'walsall', slotIndex: 0 }, { kind: 'market' }],
      beerSource: null,
    };
    expect(coalSourceLocationIds(action)).toEqual(['walsall', null]);
    expect(ironSourceLocationIds(action)).toEqual([]);
  });

  it('develop: carries one iron-source entry per industry developed', () => {
    const action: Action = {
      type: 'develop',
      player: 'p1',
      card: { kind: 'wildIndustry' },
      industries: ['cotton', 'manufacturer'],
      ironSources: [{ kind: 'works', locationId: 'dudley', slotIndex: 1 }, { kind: 'works', locationId: 'coventry', slotIndex: 2 }],
    };
    expect(ironSourceLocationIds(action)).toEqual(['dudley', 'coventry']);
    expect(coalSourceLocationIds(action)).toEqual([]);
  });

  it('sell/loan/scout/pass never target a coal or iron source', () => {
    const sell: Action = { type: 'sell', player: 'p1', card: { kind: 'wildIndustry' }, sales: [] };
    const loan: Action = { type: 'loan', player: 'p1', card: { kind: 'wildIndustry' } };
    const pass: Action = { type: 'pass', player: 'p1', card: { kind: 'wildIndustry' } };
    for (const action of [sell, loan, pass]) {
      expect(coalSourceLocationIds(action)).toEqual([]);
      expect(ironSourceLocationIds(action)).toEqual([]);
    }
  });
});
