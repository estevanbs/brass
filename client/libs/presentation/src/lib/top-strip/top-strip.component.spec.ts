import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameGateway, GameStateService } from '@brass/application';
import { baseGameView, FakeGameGateway, fakeGameGatewayProvider, player } from '../testing/fake-game-gateway';
import { TopStripComponent } from './top-strip.component';

describe('TopStripComponent', () => {
  let gameState: GameStateService;
  let gateway: FakeGameGateway;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [fakeGameGatewayProvider()] });
    gameState = TestBed.inject(GameStateService);
    gateway = TestBed.inject(GameGateway) as FakeGameGateway;
  });

  it('shows the era, round, and resource counts', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          state: { ...baseGameView().state, era: 'rail', round: 3, roundsPerEra: 8 },
        }),
      ),
    );
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(TopStripComponent);
    fixture.detectChanges();
    const era = fixture.nativeElement.querySelector('.strip-era') as HTMLElement;
    expect(era.textContent).toContain('Era Ferrovia');
    expect(era.textContent).toContain('rodada 3/8');
  });

  it('renders one chip per player, marking the human and the active player', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          humanId: 'p1',
          state: {
            ...baseGameView().state,
            turnOrder: ['p1', 'p2'],
            activePlayerIndex: 1,
            players: {
              p1: player({ id: 'p1', money: 20, victoryPoints: 5 }),
              p2: player({ id: 'p2', money: 15, victoryPoints: 8 }),
            },
          },
        }),
      ),
    );
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(TopStripComponent);
    fixture.detectChanges();
    const chips = fixture.nativeElement.querySelectorAll('.strip-player');
    expect(chips.length).toBe(2);
    expect(chips[0].classList.contains('human')).toBe(true);
    expect(chips[0].classList.contains('active')).toBe(false);
    expect(chips[1].classList.contains('active')).toBe(true);
    expect(chips[1].textContent).toContain('£15');
    expect(chips[1].textContent).toContain('8VP');
  });
});
