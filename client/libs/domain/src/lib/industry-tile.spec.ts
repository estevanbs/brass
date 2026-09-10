import { describe, expect, it } from 'vitest';
import { currentLinkPoints, findIndustryTile } from './industry-tile';
import type { BoardLinkSummary, IndustryTileDef } from './game-view.model';
import type { BuiltIndustryTile, GameState, LocationState } from './game-state.model';

const TILES: readonly IndustryTileDef[] = [
  { industry: 'coal', level: 1, cost: 5, coalCost: 0, ironCost: 0, resourceProduced: 2, beerToSell: 0, victoryPoints: 1, incomeGain: 1, locked: false, eraRestricted: true },
  { industry: 'iron', level: 2, cost: 7, coalCost: 0, ironCost: 0, resourceProduced: 3, beerToSell: 0, victoryPoints: 3, incomeGain: 1, locked: false, eraRestricted: false },
];

function tile(overrides: Partial<BuiltIndustryTile> = {}): BuiltIndustryTile {
  return { owner: 'p1', industry: 'coal', level: 1, flipped: false, resourceRemaining: 2, ...overrides };
}

function location(id: string, tiles: readonly (BuiltIndustryTile | null)[], kind: LocationState['kind'] = 'industrial'): LocationState {
  return {
    id,
    kind,
    slots: tiles.map((t) => ({ allowedIndustries: ['coal'], tile: t })),
  };
}

function state(locations: readonly LocationState[]): GameState {
  return {
    era: 'canal',
    round: 1,
    roundsPerEra: 10,
    turnOrder: ['p1', 'p2'],
    activePlayerIndex: 0,
    actionsTakenThisTurn: 0,
    players: {},
    locations: Object.fromEntries(locations.map((l) => [l.id, l])),
    links: [],
    market: { coalCubes: 13, ironCubes: 10 },
    drawDeck: [],
    wildLocationCards: 2,
    wildIndustryCards: 2,
    gameOver: false,
  };
}

function link(overrides: Partial<BoardLinkSummary> = {}): BoardLinkSummary {
  return { id: 'a__b', locations: ['a', 'b'], bonusConnections: [], era: 'both', ...overrides };
}

describe('findIndustryTile', () => {
  it('finds the def matching industry and level', () => {
    expect(findIndustryTile(TILES, 'iron', 2)).toEqual(TILES[1]);
  });

  it('returns undefined for an unknown combination', () => {
    expect(findIndustryTile(TILES, 'iron', 1)).toBeUndefined();
  });
});

describe('currentLinkPoints', () => {
  it('is 0 for a link touching only empty slots', () => {
    const s = state([location('a', [null]), location('b', [null])]);
    expect(currentLinkPoints(link(), s, TILES)).toBe(0);
  });

  it('counts the VP of every flipped tile at either end, ignoring unflipped ones', () => {
    const s = state([
      location('a', [tile({ flipped: true, industry: 'coal', level: 1 }), tile({ flipped: false })]),
      location('b', [tile({ flipped: true, industry: 'iron', level: 2, owner: 'p2' })]),
    ]);
    expect(currentLinkPoints(link(), s, TILES)).toBe(1 + 3);
  });

  it('scores 2 VP for a market end regardless of its contents', () => {
    const s = state([location('a', [tile({ flipped: true })]), location('market1', [], 'market')]);
    expect(currentLinkPoints(link({ locations: ['a', 'market1'] }), s, TILES)).toBe(1 + 2);
  });

  it('includes bonus-connection ends in the same total', () => {
    const s = state([
      location('a', [null]),
      location('b', [null]),
      location('c', [tile({ flipped: true, industry: 'coal', level: 1 })]),
    ]);
    const withBonus = link({ bonusConnections: [['a', 'c']] });
    expect(currentLinkPoints(withBonus, s, TILES)).toBe(1);
  });
});
