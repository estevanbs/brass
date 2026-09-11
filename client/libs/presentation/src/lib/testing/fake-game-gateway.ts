import { EMPTY, of, type Observable } from 'rxjs';
import { vi } from 'vitest';
import { GameGateway } from '@brass/application';
import type { GameMoveEvent, GameView, LegalActionView, PlayerState } from '@brass/domain';

/** Shared fixtures + a fake `GameGateway` for component specs in this lib — every spec that
 * needs a `GameStateService` provides this instead of talking to a real HTTP backend. */
export class FakeGameGateway implements GameGateway {
  createGame = vi.fn((): Observable<GameView> => of(baseGameView()));
  getGame = vi.fn((): Observable<GameView> => of(baseGameView()));
  submitAction = vi.fn((): Observable<GameMoveEvent> => of(moveEvent()));
  watchMoves = vi.fn((): Observable<GameMoveEvent> => EMPTY);
}

export function moveEvent(overrides: Partial<GameMoveEvent> = {}): GameMoveEvent {
  return {
    playerId: 'p1',
    actionLabel: 'Empréstimo',
    targets: { locationIds: [], linkSlotIds: [] },
    view: baseGameView(),
    ...overrides,
  };
}

export function fakeGameGatewayProvider() {
  return { provide: GameGateway, useClass: FakeGameGateway };
}

export function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    money: 17,
    spentThisRound: 0,
    incomeTrackPosition: 10,
    victoryPoints: 0,
    linkTilesRemaining: 14,
    industryStock: { coal: [], iron: [], cotton: [], manufacturer: [], pottery: [], brewery: [] },
    hand: [],
    discardPile: [],
    ...overrides,
  };
}

export function legalAction(overrides: Partial<LegalActionView> = {}): LegalActionView {
  return {
    index: 0,
    type: 'loan',
    label: 'Empréstimo',
    cardKeys: [],
    targets: { locationIds: [], linkSlotIds: [] },
    costLines: [],
    ...overrides,
  };
}

export function baseGameView(overrides: Partial<GameView> = {}): GameView {
  return {
    gameId: 'game-1',
    humanId: 'p1',
    state: {
      era: 'canal',
      round: 1,
      roundsPerEra: 8,
      turnOrder: ['p1', 'p2'],
      activePlayerIndex: 0,
      actionsTakenThisTurn: 0,
      players: { p1: player({ id: 'p1' }), p2: player({ id: 'p2', money: 17 }) },
      locations: {},
      links: [],
      market: { coalCubes: 14, ironCubes: 10 },
      drawDeck: [],
      wildLocationCards: 2,
      wildIndustryCards: 2,
      gameOver: false,
    },
    board: { locations: [], links: [] },
    industryTiles: [],
    legalActions: [],
    log: [],
    ...overrides,
  };
}
