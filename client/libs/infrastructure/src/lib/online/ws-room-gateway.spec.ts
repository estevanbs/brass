import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import type { RoomServerToClientEvent } from '@brass/domain';
import { WsRoomGateway } from './ws-room-gateway';
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

describe('WsRoomGateway', () => {
  it('createRoom sends a createRoom message', () => {
    const { connection, sent } = fakeConnection();
    new WsRoomGateway(connection).createRoom('Ana', 3);
    expect(sent).toEqual([{ event: 'createRoom', data: { hostName: 'Ana', maxPlayers: 3 } }]);
  });

  it('joinRoom sends a joinRoom message', () => {
    const { connection, sent } = fakeConnection();
    new WsRoomGateway(connection).joinRoom('ABC123', 'Beto');
    expect(sent).toEqual([{ event: 'joinRoom', data: { code: 'ABC123', name: 'Beto' } }]);
  });

  it('reconnectRoom sends a reconnectRoom message', () => {
    const { connection, sent } = fakeConnection();
    new WsRoomGateway(connection).reconnectRoom('ABC123', 'tok1');
    expect(sent).toEqual([{ event: 'reconnectRoom', data: { code: 'ABC123', token: 'tok1' } }]);
  });

  it('startRoom sends a startRoom message', () => {
    const { connection, sent } = fakeConnection();
    new WsRoomGateway(connection).startRoom('ABC123', 'tok1');
    expect(sent).toEqual([{ event: 'startRoom', data: { code: 'ABC123', token: 'tok1' } }]);
  });

  it('events$ passes the underlying connection\'s events through unchanged', () => {
    const { connection, events } = fakeConnection();
    const gateway = new WsRoomGateway(connection);
    const seen: RoomServerToClientEvent[] = [];
    gateway.events$.subscribe((e) => seen.push(e));

    events.next({ type: 'sequenceComplete' });
    expect(seen).toEqual([{ type: 'sequenceComplete' }]);
  });
});
