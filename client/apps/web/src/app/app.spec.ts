import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { EMPTY, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { GameGateway } from '@brass/application';
import type { GameMoveEvent, GameView } from '@brass/domain';
import { GameShellComponent } from '@brass/presentation';
import { App } from './app';

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
  watchMoves = vi.fn(() => EMPTY);
}

describe('App', () => {
  it('App itself is just a router outlet', async () => {
    await TestBed.configureTestingModule({ providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });

  it('GameShellComponent renders the "new game" setup form before any game exists', async () => {
    // A route config local to this test, not the production `app.routes.ts` — the real
    // `/offline` route binds a genuine `InProcessGameGateway`, which spins up an actual Web
    // Worker on construction; jsdom (this test's environment) has no `Worker` at all, so
    // exercising the real route here would fail for a reason that has nothing to do with what
    // this test checks. `app.routes.spec.ts` covers the production wiring itself, statically.
    await TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', component: GameShellComponent }]), { provide: GameGateway, useClass: FakeGameGateway }],
    }).compileComponents();

    const harness = await RouterTestingHarness.create('/');
    const compiled = harness.routeNativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Brass: Birmingham');
    expect(compiled.querySelector('main.app-main')).toBeNull();
  });
});
