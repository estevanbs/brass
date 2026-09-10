import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GameService, InMemoryGameRepository } from '@brass/backend-application';
import { GamesController } from './games.controller.js';
import { GameErrorsFilter } from './game-errors.filter.js';

interface View {
  readonly gameId: string;
  readonly humanId: string;
  readonly legalActions: readonly { readonly index: number }[];
}

describe('GamesController (e2e-ish, via @nestjs/testing + supertest)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [
        { provide: GameService, useFactory: () => new GameService(new InMemoryGameRepository()) },
        { provide: APP_FILTER, useClass: GameErrorsFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /games creates a game with legal actions for the human', async () => {
    const res = await request(app.getHttpServer()).post('/games').send({ playerCount: 2, seed: 1 });
    expect(res.status).toBe(200);
    const body = res.body as View;
    expect(body.humanId).toBe('você');
    expect(body.legalActions.length).toBeGreaterThan(0);
  });

  it('POST /games defaults playerCount and seed when omitted', async () => {
    const res = await request(app.getHttpServer()).post('/games').send({});
    expect(res.status).toBe(200);
    const body = res.body as View;
    expect(body.gameId).toBeTruthy();
  });

  it('GET /games/:id returns the same game', async () => {
    const created = await request(app.getHttpServer()).post('/games').send({ playerCount: 2, seed: 2 });
    const id = (created.body as View).gameId;

    const res = await request(app.getHttpServer()).get(`/games/${id}`);
    expect(res.status).toBe(200);
    expect((res.body as View).gameId).toBe(id);
  });

  it('GET /games/:id returns 404 with {"error": "jogo não encontrado"} for an unknown id', async () => {
    const res = await request(app.getHttpServer()).get('/games/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'jogo não encontrado' });
  });

  // Submitting an action moved to GamesGateway (/ws/games) — see games.gateway.spec.ts.
});
