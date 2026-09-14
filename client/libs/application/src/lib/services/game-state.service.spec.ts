import { TestBed } from '@angular/core/testing';
import { EMPTY, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameMoveEvent, GameView, LegalActionView, NewGameRequest } from '@brass/domain';
import { GameGateway } from '../ports/game-gateway';
import { GameStateService } from './game-state.service';

function legalAction(overrides: Partial<LegalActionView> = {}): LegalActionView {
  return {
    index: 0,
    type: 'loan',
    label: 'Empréstimo',
    cardKeys: ['industry:coal'],
    targets: { locationIds: [], linkSlotIds: [] },
    costLines: [],
    coalSourceLocationIds: [],
    ironSourceLocationIds: [],
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

function moveEvent(overrides: Partial<GameMoveEvent> = {}): GameMoveEvent {
  return {
    playerId: 'p1',
    actionLabel: 'Empréstimo',
    targets: { locationIds: [], linkSlotIds: [] },
    view: gameView(),
    ...overrides,
  };
}

class FakeGameGateway implements GameGateway {
  createGame = vi.fn((_request: NewGameRequest) => of(gameView()));
  getGame = vi.fn((_gameId: string) => of(gameView()));
  submitAction = vi.fn((_gameId: string, _actionIndex: number) => of(moveEvent()));
  watchMoves = vi.fn((_gameId: string) => EMPTY);
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

  it('loadGame fetches and stores the view by id, and clears selection state', async () => {
    gateway.getGame.mockReturnValueOnce(of(gameView({ gameId: 'room-game' })));
    await service.loadGame('room-game');
    expect(gateway.getGame).toHaveBeenCalledWith('room-game');
    expect(service.view()?.gameId).toBe('room-game');
    expect(service.statusMessage()).toBe('');
  });

  it('loadGame surfaces a gateway error as a status message instead of throwing', async () => {
    gateway.getGame.mockReturnValueOnce(throwError(() => new Error('sala não encontrada')));
    await service.loadGame('nope');
    expect(service.view()).toBeNull();
    expect(service.statusMessage()).toBe('Erro: sala não encontrada');
  });

  describe('watchMoves (live updates not triggered by this client\'s own submitAction)', () => {
    it('applies a view pushed by watchMoves after newGame', async () => {
      const moves = new Subject<GameMoveEvent>();
      gateway.watchMoves.mockReturnValueOnce(moves);
      await service.newGame(2, undefined);

      moves.next(moveEvent({ playerId: 'p2', view: gameView({ gameId: 'pushed' }) }));
      expect(service.view()?.gameId).toBe('pushed');
    });

    it('applies a view pushed by watchMoves after loadGame', async () => {
      const moves = new Subject<GameMoveEvent>();
      gateway.watchMoves.mockReturnValueOnce(moves);
      await service.loadGame('room-game');

      moves.next(moveEvent({ playerId: 'p2', view: gameView({ gameId: 'pushed' }) }));
      expect(service.view()?.gameId).toBe('pushed');
    });

    it('triggers the bot/opponent toast and highlight for a pushed move from someone else', async () => {
      const moves = new Subject<GameMoveEvent>();
      gateway.watchMoves.mockReturnValueOnce(moves);
      await service.newGame(2, undefined);

      moves.next(moveEvent({ playerId: 'p2', actionLabel: 'Passar', targets: { locationIds: ['dudley'], linkSlotIds: [] } }));
      expect(service.botMoveToast()).toMatchObject({ playerId: 'p2', actionLabel: 'Passar' });
      expect(service.botHighlight()).toEqual({ locationIds: ['dudley'], linkSlotIds: [] });
    });

    it('does not toast/highlight a pushed move that is the human\'s own', async () => {
      const moves = new Subject<GameMoveEvent>();
      gateway.watchMoves.mockReturnValueOnce(moves);
      await service.newGame(2, undefined);

      moves.next(moveEvent({ playerId: 'p1', targets: { locationIds: ['dudley'], linkSlotIds: [] } }));
      expect(service.botMoveToast()).toBeNull();
      expect(service.botHighlight()).toBeNull();
    });
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

  it('submitAction streams the human move then a bot move, ending on the last view, and resets selection', async () => {
    const loan = legalAction({ index: 0, cardKeys: ['industry:coal'] });
    gateway.createGame.mockReturnValueOnce(of(gameView({ legalActions: [loan] })));
    await service.newGame(2, undefined);
    service.selectCard('industry:coal');

    gateway.submitAction.mockReturnValueOnce(
      of(
        moveEvent({ playerId: 'p1', view: gameView({ gameId: 'game-1' }) }),
        moveEvent({ playerId: 'bot1', view: gameView({ gameId: 'game-2' }) }),
      ),
    );
    service.submitAction(0);

    expect(gateway.submitAction).toHaveBeenCalledWith('game-1', 0);
    expect(service.view()?.gameId).toBe('game-2');
    expect(service.selectedCard()).toBeNull();
    expect(service.statusMessage()).toBe('');
  });

  it('submitAction is a no-op when there is no active game', () => {
    service.submitAction(0);
    expect(gateway.submitAction).not.toHaveBeenCalled();
  });

  it('submitAction surfaces a gateway error as a status message', async () => {
    gateway.createGame.mockReturnValueOnce(of(gameView()));
    await service.newGame(2, undefined);
    gateway.submitAction.mockReturnValueOnce(throwError(() => new Error('jogo não encontrado')));
    service.submitAction(0);
    expect(service.statusMessage()).toBe('Erro: jogo não encontrado');
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

      gateway.submitAction.mockReturnValueOnce(of(moveEvent({ view: gameView({ gameId: 'after-scout' }) })));
      service.selectCard('industry:cotton'); // pick 2 -> auto-submit

      expect(gateway.submitAction).toHaveBeenCalledWith('game-1', 5);
      expect(service.view()?.gameId).toBe('after-scout');
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

  describe('chooseAction / resource-source picking', () => {
    it('opens the popup directly when matches do not differ by resource source', () => {
      const a = legalAction({ index: 0 });
      service.chooseAction('Construir', [a], { mode: 'corner' });
      expect(service.popup()).toEqual({ title: 'Construir', actions: [a], position: { mode: 'corner' } });
      expect(service.resourceChoice()).toBeNull();
    });

    it('is a no-op given zero matches', () => {
      service.chooseAction('Construir', [], { mode: 'corner' });
      expect(service.popup()).toBeNull();
      expect(service.resourceChoice()).toBeNull();
    });

    it('enters resource-choice mode instead of opening the popup when matches differ only by coal source', () => {
      const a = legalAction({ index: 0, coalSourceLocationIds: ['dudley'] });
      const b = legalAction({ index: 1, coalSourceLocationIds: ['walsall'] });
      service.chooseAction('Construir', [a, b], { mode: 'anchored', left: 10, top: 20 });

      expect(service.popup()).toBeNull();
      const pending = service.resourceChoice();
      expect(pending?.resourceKind).toBe('coal');
      expect(pending?.title).toBe('Construir');
      expect(pending?.position).toEqual({ mode: 'anchored', left: 10, top: 20 });
      expect(new Set(pending?.options.keys())).toEqual(new Set(['dudley', 'walsall']));
    });

    it('chooseResourceSource narrows to the matching candidate and opens the confirm popup once no choice remains', () => {
      const a = legalAction({ index: 0, coalSourceLocationIds: ['dudley'] });
      const b = legalAction({ index: 1, coalSourceLocationIds: ['walsall'] });
      service.chooseAction('Construir', [a, b], { mode: 'anchored', left: 10, top: 20 });

      service.chooseResourceSource('dudley');

      expect(service.resourceChoice()).toBeNull();
      expect(service.popup()).toEqual({ title: 'Construir', actions: [a], position: { mode: 'anchored', left: 10, top: 20 } });
    });

    it('chooseResourceSource advances to a second resource-choice step when one remains (e.g. a double network link)', () => {
      const a = legalAction({ index: 0, coalSourceLocationIds: ['dudley', 'walsall'] });
      const b = legalAction({ index: 1, coalSourceLocationIds: ['dudley', 'coventry'] });
      service.chooseAction('Rede', [a, b], { mode: 'corner' });

      service.chooseResourceSource('dudley'); // first slot: identical on both, so this alone shouldn't have been the pending step
      // Both a and b matched 'dudley' at index 0 — the pending step must have been about index 1 instead.

      const pending = service.resourceChoice();
      expect(pending?.resourceKind).toBe('coal');
      expect(new Set(pending?.options.keys())).toEqual(new Set(['walsall', 'coventry']));

      service.chooseResourceSource('walsall');
      expect(service.resourceChoice()).toBeNull();
      expect(service.popup()?.actions).toEqual([a]);
    });

    it('chooseResourceSource is a no-op for a location that is not one of the pending options', () => {
      const a = legalAction({ index: 0, coalSourceLocationIds: ['dudley'] });
      const b = legalAction({ index: 1, coalSourceLocationIds: ['walsall'] });
      service.chooseAction('Construir', [a, b], { mode: 'corner' });

      service.chooseResourceSource('coventry');

      expect(service.resourceChoice()).not.toBeNull();
      expect(service.popup()).toBeNull();
    });

    it('chooseResourceSource is a no-op when there is no pending choice', () => {
      service.chooseResourceSource('dudley');
      expect(service.resourceChoice()).toBeNull();
      expect(service.popup()).toBeNull();
    });

    it('cancelResourceChoice clears the pending choice without opening the popup', () => {
      const a = legalAction({ index: 0, coalSourceLocationIds: ['dudley'] });
      const b = legalAction({ index: 1, coalSourceLocationIds: ['walsall'] });
      service.chooseAction('Construir', [a, b], { mode: 'corner' });

      service.cancelResourceChoice();

      expect(service.resourceChoice()).toBeNull();
      expect(service.popup()).toBeNull();
    });

    it('selectCard cancels any pending resource choice', () => {
      const a = legalAction({ index: 0, coalSourceLocationIds: ['dudley'] });
      const b = legalAction({ index: 1, coalSourceLocationIds: ['walsall'] });
      service.chooseAction('Construir', [a, b], { mode: 'corner' });

      service.selectCard('industry:coal');

      expect(service.resourceChoice()).toBeNull();
    });

    it('submitAction cancels any pending resource choice', async () => {
      const loan = legalAction({ index: 0, cardKeys: ['industry:coal'] });
      gateway.createGame.mockReturnValueOnce(of(gameView({ legalActions: [loan] })));
      await service.newGame(2, undefined);

      const a = legalAction({ index: 0, coalSourceLocationIds: ['dudley'] });
      const b = legalAction({ index: 1, coalSourceLocationIds: ['walsall'] });
      service.chooseAction('Construir', [a, b], { mode: 'corner' });

      service.submitAction(0);

      expect(service.resourceChoice()).toBeNull();
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

  describe('botHighlight', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('is null before any action is submitted', () => {
      expect(service.botHighlight()).toBeNull();
    });

    it('pings the targets of a bot move event, straight from that event — not the diff of some before/after state', async () => {
      await service.newGame(2, undefined);

      gateway.submitAction.mockReturnValueOnce(
        of(
          moveEvent({ playerId: 'p1', targets: { locationIds: ['walsall'], linkSlotIds: [] } }),
          moveEvent({ playerId: 'bot1', targets: { locationIds: ['dudley'], linkSlotIds: [] } }),
        ),
      );
      service.submitAction(0);

      expect(service.botHighlight()).toEqual({ locationIds: ['dudley'], linkSlotIds: [] });
    });

    it('never highlights the human player\'s own move event', async () => {
      await service.newGame(2, undefined);

      gateway.submitAction.mockReturnValueOnce(of(moveEvent({ playerId: 'p1', targets: { locationIds: ['dudley'], linkSlotIds: [] } })));
      service.submitAction(0);

      expect(service.botHighlight()).toBeNull();
    });

    it('auto-clears after its display duration', async () => {
      vi.useFakeTimers();
      await service.newGame(2, undefined);

      gateway.submitAction.mockReturnValueOnce(of(moveEvent({ playerId: 'bot1', targets: { locationIds: ['dudley'], linkSlotIds: [] } })));
      service.submitAction(0);
      expect(service.botHighlight()).not.toBeNull();

      vi.advanceTimersByTime(1799);
      expect(service.botHighlight()).not.toBeNull();
      vi.advanceTimersByTime(1);
      expect(service.botHighlight()).toBeNull();
    });

    it('does not carry a stale highlight into a new action with no bot move of its own', async () => {
      await service.newGame(2, undefined);

      gateway.submitAction.mockReturnValueOnce(of(moveEvent({ playerId: 'bot1', targets: { locationIds: ['dudley'], linkSlotIds: [] } })));
      service.submitAction(0);
      expect(service.botHighlight()).not.toBeNull();

      gateway.submitAction.mockReturnValueOnce(of(moveEvent({ playerId: 'p1' })));
      service.submitAction(0);
      expect(service.botHighlight()).toBeNull();
    });
  });

  describe('botMoveToast', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('is null before any action is submitted', () => {
      expect(service.botMoveToast()).toBeNull();
    });

    it('shows a toast with the bot\'s own move label, straight from that event', async () => {
      await service.newGame(2, undefined);

      gateway.submitAction.mockReturnValueOnce(
        of(
          moveEvent({ playerId: 'p1', actionLabel: 'Empréstimo' }),
          moveEvent({ playerId: 'bot1', actionLabel: 'Construir carvão em dudley' }),
        ),
      );
      service.submitAction(0);

      expect(service.botMoveToast()).toMatchObject({ playerId: 'bot1', actionLabel: 'Construir carvão em dudley' });
    });

    it('never shows a toast for the human player\'s own move event', async () => {
      await service.newGame(2, undefined);

      gateway.submitAction.mockReturnValueOnce(of(moveEvent({ playerId: 'p1', actionLabel: 'Empréstimo' })));
      service.submitAction(0);

      expect(service.botMoveToast()).toBeNull();
    });

    it('bumps its key on every new toast, even with an identical label, so the animation always replays', async () => {
      await service.newGame(2, undefined);

      gateway.submitAction.mockReturnValueOnce(of(moveEvent({ playerId: 'bot1', actionLabel: 'Passar' })));
      service.submitAction(0);
      const firstKey = service.botMoveToast()?.key;

      gateway.submitAction.mockReturnValueOnce(of(moveEvent({ playerId: 'bot1', actionLabel: 'Passar' })));
      service.submitAction(0);
      const secondKey = service.botMoveToast()?.key;

      expect(firstKey).toBeDefined();
      expect(secondKey).toBeDefined();
      expect(secondKey).not.toBe(firstKey);
    });

    it('auto-clears after its display duration', async () => {
      vi.useFakeTimers();
      await service.newGame(2, undefined);

      gateway.submitAction.mockReturnValueOnce(of(moveEvent({ playerId: 'bot1', actionLabel: 'Passar' })));
      service.submitAction(0);
      expect(service.botMoveToast()).not.toBeNull();

      vi.advanceTimersByTime(2399);
      expect(service.botMoveToast()).not.toBeNull();
      vi.advanceTimersByTime(1);
      expect(service.botMoveToast()).toBeNull();
    });

    it('does not carry a stale toast into a new action with no bot move of its own', async () => {
      await service.newGame(2, undefined);

      gateway.submitAction.mockReturnValueOnce(of(moveEvent({ playerId: 'bot1', actionLabel: 'Passar' })));
      service.submitAction(0);
      expect(service.botMoveToast()).not.toBeNull();

      gateway.submitAction.mockReturnValueOnce(of(moveEvent({ playerId: 'p1' })));
      service.submitAction(0);
      expect(service.botMoveToast()).toBeNull();
    });
  });
});
