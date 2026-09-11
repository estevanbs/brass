import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import type { RoomServerToClientEvent, RoomView } from '@brass/domain';
import type { RoomLobbyService } from '@brass/application';
import { LazyRoomGameGateway } from './lazy-room-game-gateway';
import type { RoomConnection } from './room-connection';

function fakeConnection(): { connection: RoomConnection; sent: { event: string; data: unknown }[]; events: Subject<RoomServerToClientEvent> } {
  const events = new Subject<RoomServerToClientEvent>();
  const sent: { event: string; data: unknown }[] = [];
  const connection = {
    events$: events.asObservable(),
    send: (event: string, data: unknown) => sent.push({ event, data }),
  } as unknown as RoomConnection;
  return { connection, sent, events };
}

function fakeLobby(room: RoomView | null, token: string | null): RoomLobbyService {
  return { room: () => room, myToken: () => token } as unknown as RoomLobbyService;
}

const STARTED_ROOM: RoomView = {
  code: 'ABC123',
  maxPlayers: 2,
  status: 'started',
  hostId: 'Ana',
  seats: [{ playerId: 'Ana', isBot: false }],
  gameId: 'game-1',
};

describe('LazyRoomGameGateway', () => {
  it('throws instead of resolving when the room has not started yet', () => {
    const { connection } = fakeConnection();
    const gateway = new LazyRoomGameGateway(fakeLobby(null, null), connection);
    expect(() => gateway.getGame('anything')).toThrow('a sala ainda não iniciou a partida');
  });

  it('throws when the room is known but this seat has no token yet', () => {
    const { connection } = fakeConnection();
    const gateway = new LazyRoomGameGateway(fakeLobby({ ...STARTED_ROOM, gameId: undefined }, null), connection);
    expect(() => gateway.submitAction('game-1', 0)).toThrow('a sala ainda não iniciou a partida');
  });

  it('once started, delegates to a real RoomGameGateway using the room\'s code/token/gameId', () => {
    const { connection, sent } = fakeConnection();
    const gateway = new LazyRoomGameGateway(fakeLobby(STARTED_ROOM, 'tok1'), connection);

    gateway.submitAction('game-1', 3).subscribe();
    expect(sent).toEqual([{ event: 'submitAction', data: { code: 'ABC123', token: 'tok1', index: 3 } }]);
  });

  it('caches the resolved gateway — a later lobby state change does not affect an already-resolved gateway', () => {
    const { connection, sent } = fakeConnection();
    const lobby = { room: () => STARTED_ROOM, myToken: () => 'tok1' } as unknown as RoomLobbyService;
    const gateway = new LazyRoomGameGateway(lobby, connection);

    gateway.submitAction('game-1', 0).subscribe();
    // Simulate the lobby moving on to a different room/token after the fact.
    (lobby.room as unknown as () => RoomView) = () => ({ ...STARTED_ROOM, code: 'ZZZZZZ', gameId: 'game-2' });
    (lobby.myToken as unknown as () => string) = () => 'other-token';
    gateway.submitAction('game-1', 1).subscribe();

    expect(sent).toEqual([
      { event: 'submitAction', data: { code: 'ABC123', token: 'tok1', index: 0 } },
      { event: 'submitAction', data: { code: 'ABC123', token: 'tok1', index: 1 } },
    ]);
  });
});
