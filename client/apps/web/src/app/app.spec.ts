import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameGateway } from '@brass/application';
import type { GameMoveEvent, GameView } from '@brass/domain';
import { App } from './app';
import { routes } from './app.routes';

function emptyGameView(): GameView {
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

function emptyMoveEvent(): GameMoveEvent {
  return { playerId: 'p1', actionLabel: '', targets: { locationIds: [], linkSlotIds: [] }, view: emptyGameView() };
}

class FakeGameGateway implements GameGateway {
  createGame = vi.fn(() => of(emptyGameView()));
  getGame = vi.fn(() => of(emptyGameView()));
  submitAction = vi.fn(() => of(emptyMoveEvent()));
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: GameGateway, useClass: FakeGameGateway }],
    }).compileComponents();
  });

  it('renders the "new game" setup form before any game exists, at the root route', async () => {
    const harness = await RouterTestingHarness.create('/');
    const compiled = harness.routeNativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Brass: Birmingham');
    expect(compiled.querySelector('main.app-main')).toBeNull();
  });

  it('App itself is just a router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });
});
