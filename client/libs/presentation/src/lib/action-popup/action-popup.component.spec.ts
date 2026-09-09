import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameGateway, GameStateService } from '@brass/application';
import { baseGameView, FakeGameGateway, fakeGameGatewayProvider, legalAction } from '../testing/fake-game-gateway';
import { ActionPopupComponent } from './action-popup.component';

describe('ActionPopupComponent', () => {
  let gameState: GameStateService;
  let gateway: FakeGameGateway;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [fakeGameGatewayProvider()] });
    gameState = TestBed.inject(GameStateService);
    gateway = TestBed.inject(GameGateway) as FakeGameGateway;
  });

  it('renders nothing when no popup is open', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView()));
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(ActionPopupComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.map-popup')).toBeNull();
  });

  it('lists the popup actions and submits the chosen one', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView()));
    await gameState.newGame(2, undefined);
    const action = legalAction({ index: 9, label: 'construir carvão' });
    gameState.openPopup('construir', [action], { mode: 'corner' });

    const fixture = TestBed.createComponent(ActionPopupComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.map-popup-title').textContent).toBe('construir');

    const nextView = baseGameView({ gameId: 'after-choice' });
    gateway.submitAction.mockReturnValueOnce(of(nextView));
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.map-popup button')) as HTMLButtonElement[];
    buttons.find((b) => b.textContent === 'construir carvão')!.click();

    await vi.waitFor(() => expect(gameState.view()?.gameId).toBe('after-choice'));
  });

  it('closes the popup when "fechar" is clicked', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView()));
    await gameState.newGame(2, undefined);
    gameState.openPopup('construir', [legalAction()], { mode: 'corner' });

    const fixture = TestBed.createComponent(ActionPopupComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.popup-close') as HTMLButtonElement).click();

    expect(gameState.popup()).toBeNull();
  });
});
