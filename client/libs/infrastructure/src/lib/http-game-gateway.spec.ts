import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameMoveEvent, GameView } from '@brass/domain';
import { HttpGameGateway } from './http-game-gateway';

function gameView(overrides: Partial<GameView> = {}): GameView {
  return {
    gameId: 'g1',
    humanId: 'p1',
    state: {
      era: 'canal',
      round: 1,
      roundsPerEra: 8,
      turnOrder: ['p1'],
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

/** Minimal stand-in for the browser's `WebSocket` — good enough to drive `HttpGameGateway`'s
 * `submitAction` without a real server, since jsdom's own `WebSocket` tries an actual network
 * connection. Every instance is recorded so a test can grab "whichever socket the gateway just
 * opened" and puppet its lifecycle by calling the `trigger*` helpers directly. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly sent: string[] = [];
  closed = false;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  triggerOpen(): void {
    this.onopen?.();
  }

  triggerMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

describe('HttpGameGateway', () => {
  let gateway: HttpGameGateway;
  let httpMock: HttpTestingController;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpGameGateway, provideHttpClient(), provideHttpClientTesting()],
    });
    gateway = TestBed.inject(HttpGameGateway);
    httpMock = TestBed.inject(HttpTestingController);

    FakeWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    httpMock.verify();
    vi.stubGlobal('WebSocket', originalWebSocket);
  });

  it('createGame POSTs to /api/games with the request body', () => {
    let result: GameView | undefined;
    gateway.createGame({ playerCount: 2, seed: 7 }).subscribe((view) => (result = view));

    const req = httpMock.expectOne('/api/games');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ playerCount: 2, seed: 7 });
    req.flush(gameView());

    expect(result?.gameId).toBe('g1');
  });

  it('getGame GETs /api/games/:id', () => {
    let result: GameView | undefined;
    gateway.getGame('g1').subscribe((view) => (result = view));

    const req = httpMock.expectOne('/api/games/g1');
    expect(req.request.method).toBe('GET');
    req.flush(gameView());

    expect(result?.gameId).toBe('g1');
  });

  it('submitAction opens a WebSocket to /ws/games and sends a submitAction message once open', () => {
    gateway.submitAction('g1', 3).subscribe();
    const socket = FakeWebSocket.instances[0];
    expect(socket).toBeDefined();
    expect(socket?.url).toMatch(/\/ws\/games$/);
    expect(socket?.sent).toEqual([]);

    socket?.triggerOpen();
    expect(socket?.sent).toEqual([JSON.stringify({ event: 'submitAction', data: { gameId: 'g1', index: 3 } })]);
  });

  it('emits one GameMoveEvent per moveApplied message, in order, and completes on sequenceComplete', () => {
    const events: GameMoveEvent[] = [];
    let completed = false;
    gateway.submitAction('g1', 0).subscribe({ next: (e) => events.push(e), complete: () => (completed = true) });

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();
    socket?.triggerMessage({ type: 'moveApplied', playerId: 'você', actionLabel: 'Passar', targets: { locationIds: [], linkSlotIds: [] }, view: gameView() });
    socket?.triggerMessage({
      type: 'moveApplied',
      playerId: 'bot1',
      actionLabel: 'Construir carvão',
      targets: { locationIds: ['dudley'], linkSlotIds: [] },
      view: gameView({ log: ['bot1: Construir carvão'] }),
    });
    expect(completed).toBe(false);
    socket?.triggerMessage({ type: 'sequenceComplete' });

    expect(events.map((e) => e.playerId)).toEqual(['você', 'bot1']);
    expect(events[1]?.targets).toEqual({ locationIds: ['dudley'], linkSlotIds: [] });
    expect(completed).toBe(true);
    expect(socket?.closed).toBe(true);
  });

  it('errors the observable with the server-sent message on an error event', () => {
    let error: unknown;
    gateway.submitAction('g1', 0).subscribe({ error: (err) => (error = err) });

    const socket = FakeWebSocket.instances[0];
    socket?.triggerOpen();
    socket?.triggerMessage({ type: 'error', message: 'jogo não encontrado' });

    expect((error as Error).message).toBe('jogo não encontrado');
    expect(socket?.closed).toBe(true);
  });
});
