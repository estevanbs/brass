import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameView } from '@brass/domain';
import { HttpGameGateway } from './http-game-gateway';

function gameView(): GameView {
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
  };
}

describe('HttpGameGateway', () => {
  let gateway: HttpGameGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpGameGateway, provideHttpClient(), provideHttpClientTesting()],
    });
    gateway = TestBed.inject(HttpGameGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
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

  it('submitAction POSTs the action index to /api/games/:id/actions', () => {
    let result: GameView | undefined;
    gateway.submitAction('g1', 3).subscribe((view) => (result = view));

    const req = httpMock.expectOne('/api/games/g1/actions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ index: 3 });
    req.flush(gameView());

    expect(result?.gameId).toBe('g1');
  });
});
