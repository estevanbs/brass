import { describe, expect, it } from 'vitest';
import type { GameMoveEvent, GameView } from '@brass/domain';
import { InProcessGameGateway } from './in-process-game-gateway';
import type { WorkerRequest, WorkerResponse } from './game-worker-protocol';

function gameView(overrides: Partial<GameView> = {}): GameView {
  return {
    gameId: 'g1',
    humanId: 'você',
    state: {
      era: 'canal',
      round: 1,
      roundsPerEra: 8,
      turnOrder: ['você'],
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

/** Minimal stand-in for the browser's `Worker` — records every posted request so a test can
 * read back the `requestId` the gateway generated internally, then puppet a response by
 * calling `emit` directly (no real Worker runtime, no actual bundling of `game.worker.ts`). */
class FakeWorker {
  readonly posted: WorkerRequest[] = [];
  private readonly listeners: ((event: MessageEvent<WorkerResponse>) => void)[] = [];

  postMessage(message: WorkerRequest): void {
    this.posted.push(message);
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent<WorkerResponse>) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent<WorkerResponse>) => void): void {
    const i = this.listeners.indexOf(listener);
    if (i >= 0) this.listeners.splice(i, 1);
  }

  emit(response: WorkerResponse): void {
    for (const listener of [...this.listeners]) listener({ data: response } as MessageEvent<WorkerResponse>);
  }
}

function makeGateway(): { gateway: InProcessGameGateway; worker: FakeWorker } {
  const worker = new FakeWorker();
  const gateway = new InProcessGameGateway(() => worker as unknown as Worker);
  return { gateway, worker };
}

describe('InProcessGameGateway', () => {
  it('createGame posts a createGame request and resolves with the worker\'s view response', () => {
    const { gateway, worker } = makeGateway();
    let result: GameView | undefined;
    gateway.createGame({ playerCount: 2, seed: 7 }).subscribe((view) => (result = view));

    expect(worker.posted).toHaveLength(1);
    const req = worker.posted[0];
    expect(req).toMatchObject({ type: 'createGame', playerCount: 2, seed: 7 });

    worker.emit({ type: 'view', requestId: req!.requestId, view: gameView() });
    expect(result?.gameId).toBe('g1');
  });

  it('getGame posts a getGame request with the given id', () => {
    const { gateway, worker } = makeGateway();
    let result: GameView | undefined;
    gateway.getGame('g1').subscribe((view) => (result = view));

    const req = worker.posted[0];
    expect(req).toMatchObject({ type: 'getGame', gameId: 'g1' });

    worker.emit({ type: 'view', requestId: req!.requestId, view: gameView() });
    expect(result?.gameId).toBe('g1');
  });

  it('emits one GameMoveEvent per moveApplied message, in order, and completes on sequenceComplete', () => {
    const { gateway, worker } = makeGateway();
    const events: GameMoveEvent[] = [];
    let completed = false;
    gateway.submitAction('g1', 0).subscribe({ next: (e) => events.push(e), complete: () => (completed = true) });

    const req = worker.posted[0];
    expect(req).toMatchObject({ type: 'submitAction', gameId: 'g1', index: 0 });
    const requestId = req!.requestId;

    worker.emit({ type: 'moveApplied', requestId, playerId: 'você', actionLabel: 'Passar', targets: { locationIds: [], linkSlotIds: [] }, view: gameView() });
    worker.emit({
      type: 'moveApplied',
      requestId,
      playerId: 'bot1',
      actionLabel: 'Construir carvão',
      targets: { locationIds: ['dudley'], linkSlotIds: [] },
      view: gameView({ log: ['bot1: Construir carvão'] }),
    });
    expect(completed).toBe(false);
    worker.emit({ type: 'sequenceComplete', requestId });

    expect(events.map((e) => e.playerId)).toEqual(['você', 'bot1']);
    expect(events[1]?.targets).toEqual({ locationIds: ['dudley'], linkSlotIds: [] });
    expect(completed).toBe(true);
  });

  it('errors the observable with the worker-sent message on an error response', () => {
    const { gateway, worker } = makeGateway();
    let error: unknown;
    gateway.submitAction('g1', 0).subscribe({ error: (err) => (error = err) });

    const req = worker.posted[0];
    worker.emit({ type: 'error', requestId: req!.requestId, message: 'jogo não encontrado' });

    expect((error as Error).message).toBe('jogo não encontrado');
  });

  it('ignores a response whose requestId belongs to a different, in-flight call', () => {
    const { gateway, worker } = makeGateway();
    let firstResult: GameView | undefined;
    let secondResult: GameView | undefined;
    gateway.getGame('first').subscribe((view) => (firstResult = view));
    gateway.getGame('second').subscribe((view) => (secondResult = view));

    const [firstReq, secondReq] = worker.posted;
    // Resolve the second call before the first — the first subscriber must stay unresolved.
    worker.emit({ type: 'view', requestId: secondReq!.requestId, view: gameView({ gameId: 'second' }) });
    expect(secondResult?.gameId).toBe('second');
    expect(firstResult).toBeUndefined();

    worker.emit({ type: 'view', requestId: firstReq!.requestId, view: gameView({ gameId: 'first' }) });
    expect(firstResult?.gameId).toBe('first');
  });
});
