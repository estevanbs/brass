import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameGateway, GameStateService } from '@brass/application';
import type { Card } from '@brass/domain';
import { baseGameView, FakeGameGateway, fakeGameGatewayProvider, player } from '../testing/fake-game-gateway';
import { HandComponent } from './hand.component';

describe('HandComponent', () => {
  let gameState: GameStateService;
  let gateway: FakeGameGateway;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [fakeGameGatewayProvider()] });
    gameState = TestBed.inject(GameStateService);
    gateway = TestBed.inject(GameGateway) as FakeGameGateway;
  });

  async function startGameWithHand(hand: readonly Card[]) {
    const view = baseGameView({
      state: { ...baseGameView().state, players: { p1: player({ id: 'p1', hand }) } },
    });
    gateway.createGame.mockReturnValueOnce(of(view));
    await gameState.newGame(2, undefined);
  }

  it('renders one card per hand entry', async () => {
    await startGameWithHand([
      { kind: 'industry', industry: 'coal' },
      { kind: 'industry', industry: 'iron' },
    ]);

    const fixture = TestBed.createComponent(HandComponent);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('brass-hand-card');
    expect(cards.length).toBe(2);
  });

  it('clicking a card selects it via GameStateService', async () => {
    await startGameWithHand([{ kind: 'industry', industry: 'coal' }]);

    const fixture = TestBed.createComponent(HandComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button.hand-card') as HTMLButtonElement;
    button.click();

    expect(gameState.selectedCard()).toBe('industry:coal');
  });

  it('clicking the same card again deselects it', async () => {
    await startGameWithHand([{ kind: 'industry', industry: 'coal' }]);

    const fixture = TestBed.createComponent(HandComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button.hand-card') as HTMLButtonElement;
    button.click();
    button.click();

    expect(gameState.selectedCard()).toBeNull();
  });
});
