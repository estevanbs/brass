import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('a hand holding two identical cards (routine in Brass — e.g. two "iron" cards)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('still renders both as separate cards, and neither logs an NG0955 duplicate-track-key warning across a re-render', async () => {
      // The list used to be tracked by the card's own content-derived key (`vm.key`, e.g.
      // "industry:iron"), which collides whenever the hand holds two matching cards — Angular
      // then warns (NG0955) and can leave a stale/misattributed DOM node behind. Found via
      // mobile e2e coverage; fixed by tracking by index instead. The warning specifically fires
      // on *reconciliation* (Angular diffing the `@for` list against its previous pass), not on
      // a first render — so this must trigger a second `detectChanges()` (via a selection
      // change) to actually exercise the code path that was broken.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      await startGameWithHand([
        { kind: 'industry', industry: 'iron' },
        { kind: 'industry', industry: 'iron' },
      ]);

      const fixture = TestBed.createComponent(HandComponent);
      fixture.detectChanges();
      const cards = fixture.nativeElement.querySelectorAll('brass-hand-card');
      expect(cards.length).toBe(2);

      gameState.selectCard('industry:iron');
      fixture.detectChanges();

      expect(warn.mock.calls.some((call) => String(call[0]).includes('NG0955'))).toBe(false);
    });

    it('clicking the second, visually-identical card still selects it (via GameStateService)', async () => {
      await startGameWithHand([
        { kind: 'industry', industry: 'iron' },
        { kind: 'industry', industry: 'iron' },
      ]);

      const fixture = TestBed.createComponent(HandComponent);
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll('button.hand-card');
      expect(buttons.length).toBe(2);
      (buttons[1] as HTMLButtonElement).click();

      expect(gameState.selectedCard()).toBe('industry:iron');
    });
  });
});
