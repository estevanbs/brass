import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameGateway, GameStateService } from '@brass/application';
import { baseGameView, FakeGameGateway, fakeGameGatewayProvider, moveEvent } from '../testing/fake-game-gateway';
import { BotMoveToastComponent } from './bot-move-toast.component';

describe('BotMoveToastComponent', () => {
  let gameState: GameStateService;
  let gateway: FakeGameGateway;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [fakeGameGatewayProvider()] });
    gameState = TestBed.inject(GameStateService);
    gateway = TestBed.inject(GameGateway) as FakeGameGateway;
  });

  it('renders nothing when no bot move toast is active', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView()));
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(BotMoveToastComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bot-move-toast')).toBeNull();
  });

  it('shows the bot id and action label once a bot move streams in', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView({ humanId: 'p1' })));
    await gameState.newGame(2, undefined);

    gateway.submitAction.mockReturnValueOnce(of(moveEvent({ playerId: 'bot1', actionLabel: 'Construir carvão em dudley' })));
    gameState.submitAction(0);

    const fixture = TestBed.createComponent(BotMoveToastComponent);
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('.bot-move-toast') as HTMLElement;
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('bot1');
    expect(toast.textContent).toContain('Construir carvão em dudley');
  });
});
