import { AddressInfo } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import WebSocket from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GameService, InMemoryGameRepository, InMemoryRoomRepository, RoomService } from '@brass/backend-application';
import { RoomsGateway } from './rooms.gateway.js';
import type { RoomServerToClientEvent } from './ws-events.js';

interface View {
  readonly humanId: string;
  readonly state: { readonly players: Record<string, { readonly hand: readonly unknown[] }> };
  readonly legalActions: readonly { readonly index: number }[];
}

/** A connected test client, queuing every message it receives from the moment it connects (via
 * a persistent `'message'` listener) so `next()` never races a handler that replies with
 * *several* messages in one synchronous burst (e.g. `createRoom`'s ack immediately followed by
 * a `roomState` broadcast) — a one-shot `ws.once('message', ...)` re-armed between `await`s
 * would miss whichever of those arrived before it was re-attached. */
interface TestClient {
  readonly ws: WebSocket;
  next(): Promise<RoomServerToClientEvent>;
}

describe('RoomsGateway (e2e-ish, via real ws clients)', () => {
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: GameService, useFactory: () => new GameService(new InMemoryGameRepository()) },
        { provide: RoomService, useFactory: (games: GameService) => new RoomService(new InMemoryRoomRepository(), games), inject: [GameService] },
        RoomsGateway,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app.close();
  });

  function connect(): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws/rooms`);
      const queue: RoomServerToClientEvent[] = [];
      const waiters: ((event: RoomServerToClientEvent) => void)[] = [];
      ws.on('message', (raw: Buffer) => {
        const event = JSON.parse(raw.toString()) as RoomServerToClientEvent;
        const waiter = waiters.shift();
        if (waiter) waiter(event);
        else queue.push(event);
      });
      const next = (): Promise<RoomServerToClientEvent> =>
        new Promise((resolveNext) => {
          const queued = queue.shift();
          if (queued !== undefined) resolveNext(queued);
          else waiters.push(resolveNext);
        });
      ws.once('open', () => resolve({ ws, next }));
      ws.once('error', reject);
    });
  }

  function send(client: TestClient, event: string, data: unknown): void {
    client.ws.send(JSON.stringify({ event, data }));
  }

  it('createRoom acks the host with roomJoined, then roomState', async () => {
    const host = await connect();
    send(host, 'createRoom', { hostName: 'Ana', maxPlayers: 2 });

    const joined = await host.next();
    if (joined.type !== 'roomJoined') throw new Error('expected roomJoined');
    expect(joined.playerId).toBe('Ana');
    expect(joined.token).toBeTruthy();
    expect(joined.code).toMatch(/^[A-Z0-9]{6}$/);

    const state = await host.next();
    if (state.type !== 'roomState') throw new Error('expected roomState');
    expect(state.room.status).toBe('lobby');
    expect(state.room.seats).toEqual([{ playerId: 'Ana', isBot: false }]);

    host.ws.close();
  });

  it('joinRoom sends roomState to every connected socket in the room, host included', async () => {
    const host = await connect();
    send(host, 'createRoom', { hostName: 'Beto', maxPlayers: 3 });
    const hostJoined = await host.next();
    if (hostJoined.type !== 'roomJoined') throw new Error('expected roomJoined');
    await host.next(); // the host's own initial roomState

    const guest = await connect();
    send(guest, 'joinRoom', { code: hostJoined.code, name: 'Carla' });

    const guestJoined = await guest.next();
    if (guestJoined.type !== 'roomJoined') throw new Error('expected roomJoined');
    expect(guestJoined.playerId).toBe('Carla');

    const guestState = await guest.next();
    const hostState = await host.next();
    if (guestState.type !== 'roomState' || hostState.type !== 'roomState') throw new Error('expected roomState');
    expect(guestState.room.seats.map((s) => s.playerId)).toEqual(['Beto', 'Carla']);
    expect(hostState.room).toEqual(guestState.room);

    host.ws.close();
    guest.ws.close();
  });

  it('joinRoom errors for an unknown room code, without affecting anything else', async () => {
    const guest = await connect();
    send(guest, 'joinRoom', { code: 'NOPE00', name: 'Ninguém' });
    const error = await guest.next();
    expect(error).toEqual({ type: 'error', message: 'sala não encontrada' });
    guest.ws.close();
  });

  it('startRoom sends every connected seat its own roomStarted view, then submitAction streams moves live to both', async () => {
    const host = await connect();
    send(host, 'createRoom', { hostName: 'Duda', maxPlayers: 2 });
    const hostJoined = await host.next();
    if (hostJoined.type !== 'roomJoined') throw new Error('expected roomJoined');
    await host.next(); // roomState

    const guest = await connect();
    send(guest, 'joinRoom', { code: hostJoined.code, name: 'Eli' });
    const guestJoined = await guest.next();
    if (guestJoined.type !== 'roomJoined') throw new Error('expected roomJoined');
    await guest.next(); // roomState
    await host.next(); // roomState (broadcast of Eli joining)

    send(host, 'startRoom', { code: hostJoined.code, token: hostJoined.token });
    const hostStarted = await host.next();
    const guestStarted = await guest.next();
    if (hostStarted.type !== 'roomStarted' || guestStarted.type !== 'roomStarted') throw new Error('expected roomStarted');
    expect(hostStarted.gameId).toBe(guestStarted.gameId);

    const hostView = hostStarted.view as View;
    const guestView = guestStarted.view as View;
    // Each side sees only its own hand.
    expect(hostView.state.players['Duda']?.hand.length).toBeGreaterThan(0);
    expect(hostView.state.players['Eli']?.hand).toEqual([]);
    expect(guestView.state.players['Eli']?.hand.length).toBeGreaterThan(0);
    expect(guestView.state.players['Duda']?.hand).toEqual([]);

    // Whichever seat is actually active gets to act; the other is rejected.
    const [activeClient, activeToken, activeView, idleClient, idleToken] =
      hostView.legalActions.length > 0
        ? ([host, hostJoined.token, hostView, guest, guestJoined.token] as const)
        : ([guest, guestJoined.token, guestView, host, hostJoined.token] as const);
    const index = activeView.legalActions[0]?.index;
    if (index === undefined) throw new Error('unreachable: fresh game has no legal actions');

    // The idle seat cannot act out of turn.
    send(idleClient, 'submitAction', { code: hostJoined.code, token: idleToken, index: 0 });
    const rejection = await idleClient.next();
    expect(rejection).toEqual({ type: 'error', message: 'não é a sua vez' });

    send(activeClient, 'submitAction', { code: hostJoined.code, token: activeToken, index });
    const hostSaw: RoomServerToClientEvent[] = [];
    const guestSaw: RoomServerToClientEvent[] = [];
    while (hostSaw.at(-1)?.type !== 'sequenceComplete') hostSaw.push(await host.next());
    while (guestSaw.at(-1)?.type !== 'sequenceComplete') guestSaw.push(await guest.next());

    const hostMoves = hostSaw.filter((e): e is Extract<RoomServerToClientEvent, { type: 'moveApplied' }> => e.type === 'moveApplied');
    expect(hostMoves.length).toBeGreaterThan(0);
    expect(guestSaw.filter((e) => e.type === 'moveApplied').length).toBe(hostMoves.length);

    host.ws.close();
    guest.ws.close();
  });

  it('reconnectRoom recovers the seat and, once the room has started, its current game view', async () => {
    const host = await connect();
    send(host, 'createRoom', { hostName: 'Fifi', maxPlayers: 2 });
    const hostJoined = await host.next();
    if (hostJoined.type !== 'roomJoined') throw new Error('expected roomJoined');
    await host.next(); // roomState

    send(host, 'startRoom', { code: hostJoined.code, token: hostJoined.token });
    await host.next(); // roomStarted (this connection's own)
    host.ws.close();

    const reconnected = await connect();
    send(reconnected, 'reconnectRoom', { code: hostJoined.code, token: hostJoined.token });
    const ack = await reconnected.next();
    if (ack.type !== 'roomJoined') throw new Error('expected roomJoined');
    expect(ack.playerId).toBe('Fifi');

    const started = await reconnected.next();
    if (started.type !== 'roomStarted') throw new Error('expected roomStarted, got ' + started.type);
    expect((started.view as View).humanId).toBe('Fifi');

    reconnected.ws.close();
  });

  it('reconnectRoom errors on a token that does not belong to the room', async () => {
    const host = await connect();
    send(host, 'createRoom', { hostName: 'Gil', maxPlayers: 2 });
    const hostJoined = await host.next();
    if (hostJoined.type !== 'roomJoined') throw new Error('expected roomJoined');
    await host.next(); // roomState

    send(host, 'reconnectRoom', { code: hostJoined.code, token: 'not-a-real-token' });
    const error = await host.next();
    expect(error).toEqual({ type: 'error', message: 'token inválido' });
    host.ws.close();
  });

  it('startRoom errors when called by a non-host token', async () => {
    const host = await connect();
    send(host, 'createRoom', { hostName: 'Helo', maxPlayers: 2 });
    const hostJoined = await host.next();
    if (hostJoined.type !== 'roomJoined') throw new Error('expected roomJoined');
    await host.next(); // roomState

    const guest = await connect();
    send(guest, 'joinRoom', { code: hostJoined.code, name: 'Ivo' });
    const guestJoined = await guest.next();
    if (guestJoined.type !== 'roomJoined') throw new Error('expected roomJoined');
    await guest.next(); // roomState
    await host.next(); // roomState (broadcast of Ivo joining)

    send(guest, 'startRoom', { code: hostJoined.code, token: guestJoined.token });
    const error = await guest.next();
    expect(error).toEqual({ type: 'error', message: 'só o anfitrião pode iniciar a partida' });

    host.ws.close();
    guest.ws.close();
  });
});
