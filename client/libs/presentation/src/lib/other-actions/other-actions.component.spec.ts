import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameGateway, GameStateService } from '@brass/application';
import { baseGameView, FakeGameGateway, fakeGameGatewayProvider, legalAction } from '../testing/fake-game-gateway';
import { OtherActionsComponent } from './other-actions.component';

describe('OtherActionsComponent', () => {
  let gameState: GameStateService;
  let gateway: FakeGameGateway;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [fakeGameGatewayProvider()] });
    gameState = TestBed.inject(GameStateService);
    gateway = TestBed.inject(GameGateway) as FakeGameGateway;
  });

  it('prompts for a card selection when nothing is selected', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView()));
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(OtherActionsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.other-actions-hint').textContent).toContain('Selecione uma carta');
  });

  it('shows a Loan button when a loan is legal for the selected card, and opens a confirm popup on click (does not submit immediately)', async () => {
    const loan = legalAction({ index: 4, type: 'loan', cardKeys: ['industry:coal'] });
    gateway.createGame.mockReturnValueOnce(of(baseGameView({ legalActions: [loan] })));
    await gameState.newGame(2, undefined);
    gameState.selectCard('industry:coal');

    const fixture = TestBed.createComponent(OtherActionsComponent);
    fixture.detectChanges();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.other-action-btn')) as HTMLButtonElement[];
    const loanBtn = buttons.find((b) => b.textContent?.includes('Empréstimo'));
    expect(loanBtn).toBeDefined();

    loanBtn!.click();

    expect(gameState.popup()?.title).toBe('Empréstimo');
    expect(gameState.popup()?.actions).toEqual([loan]);
    expect(gateway.submitAction).not.toHaveBeenCalled();
  });

  it('never renders build/network actions as buttons here (they belong on the map)', async () => {
    const build = legalAction({ index: 1, type: 'build', cardKeys: ['industry:coal'] });
    const network = legalAction({ index: 2, type: 'network', cardKeys: ['industry:coal'] });
    gateway.createGame.mockReturnValueOnce(of(baseGameView({ legalActions: [build, network] })));
    await gameState.newGame(2, undefined);
    gameState.selectCard('industry:coal');

    const fixture = TestBed.createComponent(OtherActionsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.other-actions-hint').textContent).toContain('não tem jogadas legais');
  });

  it('opens a popup with the Develop options when the Develop button is clicked', async () => {
    const develop1 = legalAction({ index: 5, type: 'develop', label: 'Desenvolver coal', cardKeys: ['industry:coal'] });
    const develop2 = legalAction({ index: 6, type: 'develop', label: 'Desenvolver iron', cardKeys: ['industry:coal'] });
    gateway.createGame.mockReturnValueOnce(of(baseGameView({ legalActions: [develop1, develop2] })));
    await gameState.newGame(2, undefined);
    gameState.selectCard('industry:coal');

    const fixture = TestBed.createComponent(OtherActionsComponent);
    fixture.detectChanges();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.other-action-btn')) as HTMLButtonElement[];
    buttons.find((b) => b.textContent?.includes('Desenvolver'))!.click();

    expect(gameState.popup()?.title).toBe('Desenvolver');
    expect(gameState.popup()?.actions.length).toBe(2);
  });

  describe('resource-source picking', () => {
    it('clicking Desenvolver enters resource-choice mode (instead of opening the popup) when the develop options differ only by which iron works to use', async () => {
      const develop1 = legalAction({
        index: 5,
        type: 'develop',
        cardKeys: ['industry:coal'],
        ironSourceLocationIds: ['dudley'],
      });
      const develop2 = legalAction({
        index: 6,
        type: 'develop',
        cardKeys: ['industry:coal'],
        ironSourceLocationIds: ['coventry'],
      });
      gateway.createGame.mockReturnValueOnce(of(baseGameView({ legalActions: [develop1, develop2] })));
      await gameState.newGame(2, undefined);
      gameState.selectCard('industry:coal');

      const fixture = TestBed.createComponent(OtherActionsComponent);
      fixture.detectChanges();
      const buttons = Array.from(fixture.nativeElement.querySelectorAll('.other-action-btn')) as HTMLButtonElement[];
      buttons.find((b) => b.textContent?.includes('Desenvolver'))!.click();

      expect(gameState.popup()).toBeNull();
      expect(gameState.resourceChoice()?.resourceKind).toBe('iron');
    });

    it('shows a hint and a cancel button while a resource choice is pending, and cancel clears it', async () => {
      const develop1 = legalAction({ index: 5, type: 'develop', cardKeys: ['industry:coal'], ironSourceLocationIds: ['dudley'] });
      const develop2 = legalAction({ index: 6, type: 'develop', cardKeys: ['industry:coal'], ironSourceLocationIds: ['coventry'] });
      gateway.createGame.mockReturnValueOnce(of(baseGameView({ legalActions: [develop1, develop2] })));
      await gameState.newGame(2, undefined);
      gameState.selectCard('industry:coal');
      gameState.chooseAction('Desenvolver', [develop1, develop2], { mode: 'corner' });

      const fixture = TestBed.createComponent(OtherActionsComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.other-actions-hint').textContent).toContain('siderúrgica');

      const cancelBtn = Array.from(fixture.nativeElement.querySelectorAll('.other-action-btn')).find((b) =>
        (b as HTMLButtonElement).textContent?.includes('cancelar'),
      ) as HTMLButtonElement;
      cancelBtn.click();

      expect(gameState.resourceChoice()).toBeNull();
      expect(gameState.popup()).toBeNull();
    });
  });
});
