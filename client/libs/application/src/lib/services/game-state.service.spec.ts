import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameView, LegalActionView, NewGameRequest } from '@brass/domain';
import { GameGateway } from '../ports/game-gateway';
import { GameStateService } from './game-state.service';

function legalAction(overrides: Partial<LegalActionView> = {}): LegalActionView {
  return {
    index: 0,
    type: 'loan',
    label: 'Empréstimo',
    cardKeys: ['industry:coal'],
    targets: { locationIds: [], linkSlotIds: [] },
    ...overrides,
  };
}

function gameView(overrides: Partial<GameView> = {}): GameView {
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
      players: {},
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

class FakeGameGateway implements GameGateway {
  createGame = vi.fn((_request: NewGameRequest) => of(gameView()));
  getGame = vi.fn((_gameId: string) => of(gameView()));
  submitAction = vi.fn((_gameId: string, _actionIndex: number) => of(gameView()));
}

describe('GameStateService', () => {
  let gateway: FakeGameGateway;
  let service: GameStateService;

  beforeEach(() => {
    gateway = new FakeGameGateway();
    TestBed.configureTestingModule({
      providers: [GameStateService, { provide: GameGateway, useValue: gateway }],
    });
    service = TestBed.inject(GameStateService);
  });

  it('starts with no view and no selection', () => {
    expect(service.view()).toBeNull();
    expect(service.selectedCard()).toBeNull();
    expect(service.hasSelection()).toBe(false);
  });

  it('newGame stores the returned view and clears selection state', async () => {
    await service.newGame(2, 42);
    expect(gateway.createGame).toHaveBeenCalledWith({ playerCount: 2, seed: 42 });
    expect(service.view()?.gameId).toBe('game-1');
    expect(service.statusMessage()).toBe('');
  });

  it('newGame omits seed from the request when not provided', async () => {
    await service.newGame(3, undefined);
    expect(gateway.createGame).toHaveBeenCalledWith({ playerCount: 3 });
  });

  it('newGame surfaces a gateway error as a status message instead of throwing', async () => {
    gateway.createGame.mockReturnValueOnce(throwError(() => new Error('partida cheia')));
    await service.newGame(2, undefined);
    expect(service.view()).toBeNull();
    expect(service.statusMessage()).toBe('Erro: partida cheia');
  });

  it('selectCard toggles selection on and off', async () => {
    await service.newGame(2, undefined);
    service.selectCard('industry:coal');
    expect(service.selectedCard()).toBe('industry:coal');
    service.selectCard('industry:coal');
    expect(service.selectedCard()).toBeNull();
  });

  it('selectCard switches the active card without requiring a deselect first', async () => {
    await service.newGame(2, undefined);
    service.selectCard('industry:coal');
    service.selectCard('industry:iron');
    expect(service.selectedCard()).toBe('industry:iron');
  });

  it('filteredActions narrows legal actions to those matching the selected card', async () => {
    const loan = legalAction({ index: 0, type: 'loan', cardKeys: ['industry:coal'] });
    const pass = legalAction({ index: 1, type: 'pass', cardKeys: ['industry:iron'] });
    gateway.createGame.mockReturnValueOnce(of(gameView({ legalActions: [loan, pass] })));

    await service.newGame(2, undefined);
    service.selectCard('industry:coal');

    expect(service.filteredActions()).toEqual([loan]);
  });

  it('submitAction replaces the view and resets selection', async () => {
    const loan = legalAction({ index: 0, cardKeys: ['industry:coal'] });
    gateway.createGame.mockReturnValueOnce(of(gameView({ legalActions: [loan] })));
    await service.newGame(2, undefined);
    service.selectCard('industry:coal');

    const nextView = gameView({ gameId: 'game-2' });
    gateway.submitAction.mockReturnValueOnce(of(nextView));
    await service.submitAction(0);

    expect(gateway.submitAction).toHaveBeenCalledWith('game-1', 0);
    expect(service.view()?.gameId).toBe('game-2');
    expect(service.selectedCard()).toBeNull();
  });

  it('submitAction is a no-op when there is no active game', async () => {
    await service.submitAction(0);
    expect(gateway.submitAction).not.toHaveBeenCalled();
  });

  describe('scout mode', () => {
    it('startScout enters scout mode with no picks yet', async () => {
      await service.newGame(2, undefined);
      service.startScout();
      expect(service.scoutMode()).toBe(true);
      expect(service.scoutPicks()).toEqual([]);
    });

    it('cancelScout clears scout mode, picks, and any card selection', async () => {
      await service.newGame(2, undefined);
      service.selectCard('industry:coal');
      service.startScout();
      service.cancelScout();
      expect(service.scoutMode()).toBe(false);
      expect(service.scoutPicks()).toEqual([]);
      expect(service.selectedCard()).toBeNull();
    });

    it('accumulates up to two scout picks via selectCard, then auto-submits the matching action', async () => {
      const scoutAction = legalAction({
        index: 5,
        type: 'scout',
        cardKeys: ['industry:coal', 'industry:iron', 'industry:cotton'],
      });
      gateway.createGame.mockReturnValueOnce(of(gameView({ legalActions: [scoutAction] })));
      await service.newGame(2, undefined);

      service.selectCard('industry:coal'); // the "base" card for scout
      service.startScout();
      service.selectCard('industry:iron'); // pick 1
      expect(service.isScoutPick('industry:iron')).toBe(true);
      expect(gateway.submitAction).not.toHaveBeenCalled();

      const nextView = gameView({ gameId: 'after-scout' });
      gateway.submitAction.mockReturnValueOnce(of(nextView));
      service.selectCard('industry:cotton'); // pick 2 -> auto-submit

      await vi.waitFor(() => expect(gateway.submitAction).toHaveBeenCalledWith('game-1', 5));
      await vi.waitFor(() => expect(service.view()?.gameId).toBe('after-scout'));
    });

    it('does not let the base card be re-picked as one of its own scout discards', async () => {
      const scoutAction = legalAction({ index: 5, type: 'scout', cardKeys: ['industry:coal'] });
      gateway.createGame.mockReturnValueOnce(of(gameView({ legalActions: [scoutAction] })));
      await service.newGame(2, undefined);

      service.selectCard('industry:coal');
      service.startScout();
      service.selectCard('industry:coal');

      expect(service.scoutPicks()).toEqual([]);
    });
  });

  describe('popup', () => {
    it('openPopup / closePopup drive the popup signal', () => {
      expect(service.popup()).toBeNull();
      service.openPopup('Desenvolver', [legalAction()], { mode: 'corner' });
      expect(service.popup()?.title).toBe('Desenvolver');
      service.closePopup();
      expect(service.popup()).toBeNull();
    });

    it('selectCard closes any open popup', () => {
      service.openPopup('Desenvolver', [legalAction()], { mode: 'corner' });
      service.selectCard('industry:coal');
      expect(service.popup()).toBeNull();
    });
  });

  describe('selectedMatPlayer', () => {
    it('defaults to the human player once a game exists', async () => {
      await service.newGame(2, undefined);
      expect(service.selectedMatPlayer()).toBe('p1');
    });

    it('follows an explicit selectMatPlayer call', async () => {
      await service.newGame(2, undefined);
      service.selectMatPlayer('p2');
      expect(service.selectedMatPlayer()).toBe('p2');
    });
  });
});
