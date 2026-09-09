import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameGateway, GameStateService } from '@brass/application';
import { baseGameView, FakeGameGateway, fakeGameGatewayProvider, player } from '../testing/fake-game-gateway';
import { GameOverComponent } from './game-over.component';

describe('GameOverComponent', () => {
  let gameState: GameStateService;
  let gateway: FakeGameGateway;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [fakeGameGatewayProvider()] });
    gameState = TestBed.inject(GameStateService);
    gateway = TestBed.inject(GameGateway) as FakeGameGateway;
  });

  it('stays hidden while the game is ongoing', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView({ state: { ...baseGameView().state, gameOver: false } })));
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(GameOverComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.overlay')).toBeNull();
  });

  it('shows the scoreboard sorted by victory points, highest first, once the game ends', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          state: {
            ...baseGameView().state,
            gameOver: true,
            players: {
              p1: player({ id: 'p1', victoryPoints: 40 }),
              p2: player({ id: 'p2', victoryPoints: 55 }),
            },
          },
        }),
      ),
    );
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(GameOverComponent);
    fixture.detectChanges();
    const rows = Array.from(fixture.nativeElement.querySelectorAll('.score-row')) as HTMLElement[];
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('p2');
    expect(rows[0].textContent).toContain('55 VP');
    expect(rows[1].textContent).toContain('p1');
  });
});
