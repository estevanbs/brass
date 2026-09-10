import { AddressInfo } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import WebSocket from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GameService, InMemoryGameRepository } from '@brass/backend-application';
import { GamesGateway } from './games.gateway.js';
import type { ServerToClientEvent } from './ws-events.js';

interface View {
  readonly legalActions: readonly { readonly index: number }[];
}

describe('GamesGateway (e2e-ish, via a real ws client)', () => {
  let app: INestApplication;
  let port: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [{ provide: GameService, useFactory: () => new GameService(new InMemoryGameRepository()) }, GamesGateway],
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

  function connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws/games`);
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  function collectUntilComplete(ws: WebSocket): Promise<ServerToClientEvent[]> {
    return new Promise((resolve) => {
      const events: ServerToClientEvent[] = [];
      ws.on('message', (data: Buffer) => {
        const event = JSON.parse(data.toString()) as ServerToClientEvent;
        events.push(event);
        if (event.type === 'sequenceComplete' || event.type === 'error') resolve(events);
      });
    });
  }

  function createGameDirectly(): { id: string; index: number } {
    const gameService = app.get(GameService);
    const { id, view } = gameService.createGame(2, 1);
    const legalActions = (view as View).legalActions;
    const index = legalActions[0]?.index;
    if (index === undefined) throw new Error('unreachable: fresh game has no legal actions');
    return { id, index };
  }

  it('streams one moveApplied event per move, in order, ending with sequenceComplete', async () => {
    const { id, index } = createGameDirectly();
    const ws = await connect();
    ws.send(JSON.stringify({ event: 'submitAction', data: { gameId: id, index } }));
    const events = await collectUntilComplete(ws);
    ws.close();

    expect(events[events.length - 1]).toEqual({ type: 'sequenceComplete' });
    const moves = events.filter((e): e is Extract<ServerToClientEvent, { type: 'moveApplied' }> => e.type === 'moveApplied');
    expect(moves.length).toBeGreaterThan(0);
    // The human's own move always streams first.
    expect(moves[0]?.playerId).toBe('você');
  });

  it('sends a single error event for an unknown gameId', async () => {
    const ws = await connect();
    ws.send(JSON.stringify({ event: 'submitAction', data: { gameId: 'does-not-exist', index: 0 } }));
    const events = await collectUntilComplete(ws);
    ws.close();
    expect(events).toEqual([{ type: 'error', message: 'jogo não encontrado' }]);
  });

  it('sends a single error event for an invalid action index', async () => {
    const { id } = createGameDirectly();
    const ws = await connect();
    ws.send(JSON.stringify({ event: 'submitAction', data: { gameId: id, index: 999 } }));
    const events = await collectUntilComplete(ws);
    ws.close();
    expect(events).toEqual([{ type: 'error', message: 'índice de ação inválido' }]);
  });
});
