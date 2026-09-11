import { describe, expect, it } from 'vitest';
import type { RoomServerToClientEvent } from '@brass/domain';
import { RoomConnection } from './room-connection';

/** Minimal stand-in for the browser's `WebSocket`, good enough to drive `RoomConnection`
 * without a real server — same pattern as `http-game-gateway.spec.ts`'s `FakeWebSocket`, but
 * kept local since only this file needs it (nothing else in `online/` talks to a raw socket
 * directly; everything else goes through `RoomConnection`). */
class FakeWebSocket {
  readyState = 0; // CONNECTING
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly sent: string[] = [];
  closed = false;
  private readonly openListeners: (() => void)[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  addEventListener(type: 'open', listener: () => void): void {
    if (type === 'open') this.openListeners.push(listener);
  }

  triggerOpen(): void {
    this.readyState = 1; // OPEN
    for (const listener of this.openListeners) listener();
  }

  triggerMessage(payload: RoomServerToClientEvent): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  triggerError(): void {
    this.onerror?.();
  }
}

function makeConnection(): { connection: RoomConnection; ws: FakeWebSocket } {
  const ws = new FakeWebSocket();
  const connection = new RoomConnection(() => ws as unknown as WebSocket);
  return { connection, ws };
}

describe('RoomConnection', () => {
  it('queues a send until the socket is open, then flushes it', () => {
    const { connection, ws } = makeConnection();
    connection.send('createRoom', { hostName: 'Ana', maxPlayers: 2 });
    expect(ws.sent).toEqual([]);

    ws.triggerOpen();
    expect(ws.sent).toEqual([JSON.stringify({ event: 'createRoom', data: { hostName: 'Ana', maxPlayers: 2 } })]);
  });

  it('sends immediately once the socket is already open', () => {
    const { connection, ws } = makeConnection();
    ws.triggerOpen();
    connection.send('startRoom', { code: 'ABC123', token: 't1' });
    expect(ws.sent).toEqual([JSON.stringify({ event: 'startRoom', data: { code: 'ABC123', token: 't1' } })]);
  });

  it('emits every parsed incoming message on events$', () => {
    const { connection, ws } = makeConnection();
    const events: RoomServerToClientEvent[] = [];
    connection.events$.subscribe((e) => events.push(e));

    ws.triggerMessage({ type: 'roomJoined', code: 'ABC123', token: 't1', playerId: 'Ana' });
    ws.triggerMessage({ type: 'sequenceComplete' });

    expect(events).toEqual([{ type: 'roomJoined', code: 'ABC123', token: 't1', playerId: 'Ana' }, { type: 'sequenceComplete' }]);
  });

  it('feeds every subscriber the same events (multicast, not one fresh connection per call)', () => {
    const { connection, ws } = makeConnection();
    const a: RoomServerToClientEvent[] = [];
    const b: RoomServerToClientEvent[] = [];
    connection.events$.subscribe((e) => a.push(e));
    connection.events$.subscribe((e) => b.push(e));

    ws.triggerMessage({ type: 'sequenceComplete' });
    expect(a).toEqual([{ type: 'sequenceComplete' }]);
    expect(b).toEqual([{ type: 'sequenceComplete' }]);
  });

  it('emits a synthetic error event on a socket-level error', () => {
    const { connection, ws } = makeConnection();
    const events: RoomServerToClientEvent[] = [];
    connection.events$.subscribe((e) => events.push(e));

    ws.triggerError();
    expect(events).toEqual([{ type: 'error', message: 'erro de conexão com o servidor' }]);
  });

  it('close() closes the underlying socket', () => {
    const { connection, ws } = makeConnection();
    connection.close();
    expect(ws.closed).toBe(true);
  });
});
