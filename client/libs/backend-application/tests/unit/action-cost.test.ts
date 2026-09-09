import { describe, expect, it } from 'vitest';
import { actionCostLines } from '../../src/lib/action-cost.js';
import type { Action } from '@brass/backend-domain';
import { anyCard, makePlayer, makeState, tile, withMerchant, withTile } from '../helpers/fixtures.js';

function findValue(lines: readonly { label: string; value: string }[], label: string): string | undefined {
  return lines.find((l) => l.label === label)?.value;
}

describe('actionCostLines', () => {
  it('build: reports the money spent, the piece removed, and the coal source', () => {
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
    const state = makeState({ players: { p1: makePlayer('p1', { hand: [action.card] }), p2: makePlayer('p2') } });
    const lines = actionCostLines(state, action);
    expect(findValue(lines, 'Dinheiro')).toBe('-£5'); // level-1 coal, canal era, no coal/iron needed
    expect(findValue(lines, 'Peça')).toBe('mina de carvão nível 1');
    expect(lines.find((l) => l.label === 'Carvão')).toBeUndefined();
  });

  it('build: names a market coal source explicitly', () => {
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
    const state = makeState({
      links: [{ slotId: 'worcester__gloucester', owner: 'p1', kind: 'canal' }],
      players: { p1: makePlayer('p1', { hand: [action.card] }), p2: makePlayer('p2') },
    });
    const lines = actionCostLines(state, action);
    expect(findValue(lines, 'Carvão')).toBe('do mercado');
  });

  it('network: reports the link id and the coal source for a rail-era single link', () => {
    const action: Action = {
      type: 'network',
      player: 'p1',
      card: anyCard(),
      linkSlotIds: ['warrington__stoke_on_trent'],
      coalSources: [{ kind: 'market' }],
      beerSource: null,
    };
    const state = makeState({ era: 'rail', players: { p1: makePlayer('p1', { hand: [action.card] }), p2: makePlayer('p2') } });
    const lines = actionCostLines(state, action);
    expect(findValue(lines, 'Link')).toBe('warrington__stoke_on_trent');
    expect(findValue(lines, 'Carvão')).toBe('do mercado');
    expect(findValue(lines, 'Dinheiro')).toBe('-£6'); // £5 + £1 (13/14 coal cubes)
  });

  it('develop: reports the piece removed and an own-works iron source with no money cost', () => {
    const action: Action = {
      type: 'develop',
      player: 'p1',
      card: anyCard(),
      industries: ['coal'],
      ironSources: [{ kind: 'works', locationId: 'dudley', slotIndex: 1 }],
    };
    let state = makeState({ players: { p1: makePlayer('p1', { hand: [action.card] }), p2: makePlayer('p2') } });
    state = { ...state, locations: withTile(state.locations, 'dudley', 1, tile('p1', 'iron', 1, 2)) };
    const lines = actionCostLines(state, action);
    expect(findValue(lines, 'Peça removida')).toBe('mina de carvão nível 1');
    expect(findValue(lines, 'Ferro')).toBe('de dudley (própria siderúrgica)');
    expect(lines.find((l) => l.label === 'Dinheiro')).toBeUndefined();
  });

  it('sell: reports the location(s) sold and the beer source, with no money line (money comes as a merchant bonus, not tracked here)', () => {
    const action: Action = {
      type: 'sell',
      player: 'p1',
      card: anyCard(),
      sales: [{ locationId: 'worcester', slotIndex: 0, beerSources: [{ kind: 'brewery', locationId: 'nuneaton', slotIndex: 0 }] }],
    };
    let state = makeState({
      links: [{ slotId: 'worcester__gloucester', owner: 'p1', kind: 'canal' }],
      players: { p1: makePlayer('p1', { hand: [action.card] }), p2: makePlayer('p2') },
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
    const lines = actionCostLines(state, action);
    expect(findValue(lines, 'Local')).toBe('worcester[0]');
    expect(findValue(lines, 'Cerveja')).toBe('de nuneaton (própria cervejaria)');
  });

  it('loan: reports the money gained and the income track drop', () => {
    const action: Action = { type: 'loan', player: 'p1', card: anyCard() };
    const state = makeState({ players: { p1: makePlayer('p1', { hand: [action.card], incomeTrackPosition: 20 }), p2: makePlayer('p2') } });
    const lines = actionCostLines(state, action);
    expect(findValue(lines, 'Dinheiro')).toBe('+£30');
    expect(findValue(lines, 'Renda')).toMatch(/nível \d+ → nível \d+/);
  });

  it('scout: reports the discard/receive summary with no money line', () => {
    const action: Action = {
      type: 'scout',
      player: 'p1',
      cards: [
        { kind: 'industry', industry: 'coal' },
        { kind: 'industry', industry: 'iron' },
        { kind: 'industry', industry: 'cotton' },
      ],
    };
    const state = makeState({
      players: {
        p1: makePlayer('p1', { hand: [{ kind: 'industry', industry: 'coal' }, { kind: 'industry', industry: 'iron' }, { kind: 'industry', industry: 'cotton' }] }),
        p2: makePlayer('p2'),
      },
    });
    const lines = actionCostLines(state, action);
    expect(findValue(lines, 'Descarta')).toBe('3 cartas da mão');
    expect(lines.find((l) => l.label === 'Dinheiro')).toBeUndefined();
  });

  it('pass: reports no cost lines at all', () => {
    const action: Action = { type: 'pass', player: 'p1', card: anyCard() };
    const state = makeState({ players: { p1: makePlayer('p1', { hand: [action.card] }), p2: makePlayer('p2') } });
    expect(actionCostLines(state, action)).toEqual([]);
  });
});
