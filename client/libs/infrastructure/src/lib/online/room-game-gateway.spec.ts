import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import type { GameMoveEvent, GameView, RoomServerToClientEvent } from '@brass/domain';
import { RoomGameGateway } from './room-game-gateway';
import type { RoomConnection } from './room-connection';

function gameView(overrides: Partial<GameView> = {}): GameView {
  return {
    gameId: 'game-1',
    humanId: 'Ana',
    state: {
      era: 'canal',
      round: 1,
      roundsPerEra: 8,
      turnOrder: ['Ana'],
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

/** Records every `send` call and lets a test push whatever `events$` should emit next — a
 * fake `RoomConnection`, not a fake `WebSocket`, since `RoomConnection`'s own transport
 * behavior is already covered by `room-connection.spec.ts`; this file only needs to check
 * `RoomGameGateway`'s message routing. */
function fakeConnection(): { connection: RoomConnection; sent: { event: string; data: unknown }[]; events: Subject<RoomServerToClientEvent> } {
  const events = new Subject<RoomServerToClientEvent>();
  const sent: { event: string; data: unknown }[] = [];
  const connection = {
    events$: events.asObservable(),
    send: (event: string, data: unknown) => sent.push({ event, data }),
  } as unknown as RoomConnection;
  return { connection, sent, events };
}

describe('RoomGameGateway', () => {
  it('getGame sends reconnectRoom and resolves with the roomStarted view', () => {
    const { connection, sent, events } = fakeConnection();
    const gateway = new RoomGameGateway(connection, 'ABC123', 'tok1', 'game-1');

    let result: GameView | undefined;
    gateway.getGame('game-1').subscribe((view) => (result = view));

    expect(sent).toEqual([{ event: 'reconnectRoom', data: { code: 'ABC123', token: 'tok1' } }]);
    events.next({ type: 'roomJoined', code: 'ABC123', token: 'tok1', playerId: 'Ana' });
    expect(result).toBeUndefined(); // not the response getGame is waiting for
    events.next({ type: 'roomStarted', gameId: 'game-1', view: gameView() });
    expect(result?.gameId).toBe('game-1');
  });

  it('createGame ignores the request and behaves exactly like getGame', () => {
    const { connection, sent, events } = fakeConnection();
    const gateway = new RoomGameGateway(connection, 'ABC123', 'tok1', 'game-1');

    let result: GameView | undefined;
    gateway.createGame({ playerCount: 4, seed: 1 }).subscribe((view) => (result = view));

    expect(sent).toEqual([{ event: 'reconnectRoom', data: { code: 'ABC123', token: 'tok1' } }]);
    events.next({ type: 'roomStarted', gameId: 'game-1', view: gameView({ gameId: 'game-1' }) });
    expect(result?.gameId).toBe('game-1');
  });

  it('getGame errors the observable on an error event', () => {
    const { connection, events } = fakeConnection();
    const gateway = new RoomGameGateway(connection, 'ABC123', 'tok1', 'game-1');

    let error: unknown;
    gateway.getGame('game-1').subscribe({ error: (err) => (error = err) });
    events.next({ type: 'error', message: 'token inválido' });
    expect((error as Error).message).toBe('token inválido');
  });

  it('submitAction sends submitAction and streams moveApplied events until sequenceComplete', () => {
    const { connection, sent, events } = fakeConnection();
    const gateway = new RoomGameGateway(connection, 'ABC123', 'tok1', 'game-1');

    const moves: GameMoveEvent[] = [];
    let completed = false;
    gateway.submitAction('game-1', 2).subscribe({ next: (e) => moves.push(e), complete: () => (completed = true) });

    expect(sent).toEqual([{ event: 'submitAction', data: { code: 'ABC123', token: 'tok1', index: 2 } }]);
    events.next({ type: 'moveApplied', playerId: 'Ana', actionLabel: 'Passar', targets: { locationIds: [], linkSlotIds: [] }, view: gameView() });
    expect(completed).toBe(false);
    events.next({ type: 'sequenceComplete' });

    expect(moves.map((m) => m.playerId)).toEqual(['Ana']);
    expect(completed).toBe(true);
  });

  it('submitAction errors the observable on an error event', () => {
    const { connection, events } = fakeConnection();
    const gateway = new RoomGameGateway(connection, 'ABC123', 'tok1', 'game-1');

    let error: unknown;
    gateway.submitAction('game-1', 0).subscribe({ error: (err) => (error = err) });
    events.next({ type: 'error', message: 'não é a sua vez' });
    expect((error as Error).message).toBe('não é a sua vez');
  });

  it('watchMoves forwards every moveApplied indefinitely, ignoring sequenceComplete/error', () => {
    const { connection, events } = fakeConnection();
    const gateway = new RoomGameGateway(connection, 'ABC123', 'tok1', 'game-1');

    const moves: GameMoveEvent[] = [];
    let completed = false;
    let errored = false;
    gateway.watchMoves('game-1').subscribe({ next: (e) => moves.push(e), complete: () => (completed = true), error: () => (errored = true) });

    events.next({ type: 'moveApplied', playerId: 'Beto', actionLabel: 'Construir carvão', targets: { locationIds: ['dudley'], linkSlotIds: [] }, view: gameView() });
    events.next({ type: 'sequenceComplete' });
    events.next({ type: 'error', message: 'algo não relacionado' });
    events.next({ type: 'moveApplied', playerId: 'Ana', actionLabel: 'Passar', targets: { locationIds: [], linkSlotIds: [] }, view: gameView() });

    expect(moves.map((m) => m.playerId)).toEqual(['Beto', 'Ana']);
    expect(completed).toBe(false);
    expect(errored).toBe(false);
  });
});
