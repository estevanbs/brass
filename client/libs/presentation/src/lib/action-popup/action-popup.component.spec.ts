import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameGateway, GameStateService } from '@brass/application';
import { baseGameView, FakeGameGateway, fakeGameGatewayProvider, legalAction, moveEvent } from '../testing/fake-game-gateway';
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

    gateway.submitAction.mockReturnValueOnce(of(moveEvent({ view: baseGameView({ gameId: 'after-choice' }) })));
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.map-popup button')) as HTMLButtonElement[];
    buttons.find((b) => b.textContent === 'construir carvão')!.click();

    expect(gameState.view()?.gameId).toBe('after-choice');
  });

  it('closes the popup when "cancelar" is clicked, without submitting anything', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView()));
    await gameState.newGame(2, undefined);
    gameState.openPopup('construir', [legalAction()], { mode: 'corner' });

    const fixture = TestBed.createComponent(ActionPopupComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.popup-close') as HTMLButtonElement).click();

    expect(gameState.popup()).toBeNull();
    expect(gateway.submitAction).not.toHaveBeenCalled();
  });

  it('shows the cost breakdown for an option that has one, as the confirmation detail', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView()));
    await gameState.newGame(2, undefined);
    const action = legalAction({
      index: 3,
      label: 'Construir mina de carvão em dudley',
      costLines: [
        { label: 'Dinheiro', value: '-£5' },
        { label: 'Peça', value: 'mina de carvão nível 1' },
      ],
    });
    gameState.openPopup('Confirmar', [action], { mode: 'corner' });

    const fixture = TestBed.createComponent(ActionPopupComponent);
    fixture.detectChanges();
    const costLines = Array.from(fixture.nativeElement.querySelectorAll('.popup-cost-line')) as HTMLElement[];
    const texts = costLines.map((el) => el.textContent?.trim());
    expect(texts).toEqual(['Dinheiro: -£5', 'Peça: mina de carvão nível 1']);
  });

  it('renders no cost-line block for an option with an empty cost (e.g. Pass)', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView()));
    await gameState.newGame(2, undefined);
    gameState.openPopup('Passar', [legalAction({ label: 'Passar', costLines: [] })], { mode: 'corner' });

    const fixture = TestBed.createComponent(ActionPopupComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.popup-cost-lines')).toBeNull();
  });
});
