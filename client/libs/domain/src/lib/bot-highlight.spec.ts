import { describe, expect, it } from 'vitest';
import { diffBotMoves } from './bot-highlight';
import type { ActionTargets } from './game-view.model';
import type { BuiltIndustryTile, GameState, LocationState } from './game-state.model';

const NO_TARGETS: ActionTargets = { locationIds: [], linkSlotIds: [] };

function tile(overrides: Partial<BuiltIndustryTile> = {}): BuiltIndustryTile {
  return { owner: 'p1', industry: 'coal', level: 1, flipped: false, resourceRemaining: 2, ...overrides };
}

function location(id: string, tiles: readonly (BuiltIndustryTile | null)[]): LocationState {
  return {
    id,
    kind: 'industrial',
    slots: tiles.map((t) => ({ allowedIndustries: ['coal'], tile: t })),
  };
}

function state(locations: readonly LocationState[], links: GameState['links'] = []): GameState {
  return {
    era: 'canal',
    round: 1,
    roundsPerEra: 10,
    turnOrder: ['p1', 'p2'],
    activePlayerIndex: 0,
    actionsTakenThisTurn: 0,
    players: {},
    locations: Object.fromEntries(locations.map((l) => [l.id, l])),
    links,
    market: { coalCubes: 13, ironCubes: 10 },
    drawDeck: [],
    wildLocationCards: 2,
    wildIndustryCards: 2,
    gameOver: false,
  };
}

describe('diffBotMoves', () => {
  it('flags a location whose slot went from empty to built', () => {
    const before = state([location('dudley', [null, null])]);
    const after = state([location('dudley', [tile(), null])]);
    expect(diffBotMoves(before, after, NO_TARGETS).locationIds).toEqual(['dudley']);
  });

  it('flags a location whose tile flipped (sold)', () => {
    const before = state([location('worcester', [tile({ flipped: false })])]);
    const after = state([location('worcester', [tile({ flipped: true })])]);
    expect(diffBotMoves(before, after, NO_TARGETS).locationIds).toEqual(['worcester']);
  });

  it('excludes a location the human action itself already targeted', () => {
    const before = state([location('dudley', [null])]);
    const after = state([location('dudley', [tile()])]);
    const humanTargets: ActionTargets = { locationIds: ['dudley'], linkSlotIds: [] };
    expect(diffBotMoves(before, after, humanTargets).locationIds).toEqual([]);
  });

  it('ignores locations with no change', () => {
    const before = state([location('dudley', [tile()])]);
    const after = state([location('dudley', [tile()])]);
    expect(diffBotMoves(before, after, NO_TARGETS).locationIds).toEqual([]);
  });

  it('flags a newly built link', () => {
    const before = state([], []);
    const after = state([], [{ slotId: 'dudley__birmingham', owner: 'p2', kind: 'canal' }]);
    expect(diffBotMoves(before, after, NO_TARGETS).linkSlotIds).toEqual(['dudley__birmingham']);
  });

  it('excludes a link the human action itself just built', () => {
    const before = state([], []);
    const after = state([], [{ slotId: 'dudley__birmingham', owner: 'p1', kind: 'canal' }]);
    const humanTargets: ActionTargets = { locationIds: [], linkSlotIds: ['dudley__birmingham'] };
    expect(diffBotMoves(before, after, humanTargets).linkSlotIds).toEqual([]);
  });

  it('reports both a bot-built location and link from one multi-bot-turn diff', () => {
    const before = state([location('dudley', [null])], []);
    const after = state(
      [location('dudley', [tile({ owner: 'p2' })])],
      [{ slotId: 'walsall__birmingham', owner: 'p3', kind: 'canal' }],
    );
    const result = diffBotMoves(before, after, NO_TARGETS);
    expect(result.locationIds).toEqual(['dudley']);
    expect(result.linkSlotIds).toEqual(['walsall__birmingham']);
  });
});
