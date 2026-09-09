import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameGateway, GameStateService } from '@brass/application';
import { baseGameView, FakeGameGateway, fakeGameGatewayProvider, legalAction } from '../testing/fake-game-gateway';
import { BoardMapComponent } from './board-map.component';

describe('BoardMapComponent', () => {
  let gameState: GameStateService;
  let gateway: FakeGameGateway;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [fakeGameGatewayProvider()] });
    gameState = TestBed.inject(GameStateService);
    gateway = TestBed.inject(GameGateway) as FakeGameGateway;
  });

  it('shows the "select a card" hint when nothing is selected', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(baseGameView({ board: { locations: [{ id: 'birmingham', kind: 'industrial' }], links: [] } })),
    );
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(BoardMapComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.map-hint').textContent).toContain('Selecione uma carta');
  });

  it('marks a location as a clickable target only when a legal action points at it', async () => {
    const buildAtBirmingham = legalAction({
      index: 2,
      type: 'build',
      cardKeys: ['industry:coal'],
      targets: { locationIds: ['birmingham'], linkSlotIds: [] },
    });
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          legalActions: [buildAtBirmingham],
          board: {
            locations: [
              { id: 'birmingham', kind: 'industrial' },
              { id: 'oxford', kind: 'industrial' },
            ],
            links: [],
          },
        }),
      ),
    );
    await gameState.newGame(2, undefined);
    gameState.selectCard('industry:coal');

    const fixture = TestBed.createComponent(BoardMapComponent);
    fixture.detectChanges();
    const targetNodes = fixture.nativeElement.querySelectorAll('g.map-target-node');
    expect(targetNodes.length).toBe(1);
    expect((fixture.nativeElement.querySelector('.map-hint') as HTMLElement | null)).toBeNull();
  });

  it('clicking a node with exactly one matching action submits it directly (no popup)', async () => {
    const buildAtBirmingham = legalAction({
      index: 2,
      type: 'build',
      cardKeys: ['industry:coal'],
      targets: { locationIds: ['birmingham'], linkSlotIds: [] },
    });
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          legalActions: [buildAtBirmingham],
          board: { locations: [{ id: 'birmingham', kind: 'industrial' }], links: [] },
        }),
      ),
    );
    await gameState.newGame(2, undefined);
    gameState.selectCard('industry:coal');

    const fixture = TestBed.createComponent(BoardMapComponent);
    fixture.detectChanges();
    const nextView = baseGameView({ gameId: 'after-build' });
    gateway.submitAction.mockReturnValueOnce(of(nextView));

    const clickableCircle = fixture.nativeElement.querySelector('g.map-target-node circle:not(.pulse-ring)') as SVGCircleElement;
    clickableCircle.dispatchEvent(new Event('click', { bubbles: true }));

    await vi.waitFor(() => expect(gameState.view()?.gameId).toBe('after-build'));
    expect(gameState.popup()).toBeNull();
  });

  it('clicking a node with more than one matching action opens a popup instead of submitting', async () => {
    const buildA = legalAction({
      index: 2,
      type: 'build',
      label: 'construir carvão',
      cardKeys: ['industry:coal'],
      targets: { locationIds: ['birmingham'], linkSlotIds: [] },
    });
    const buildB = legalAction({
      index: 3,
      type: 'build',
      label: 'construir ferro',
      cardKeys: ['industry:coal'],
      targets: { locationIds: ['birmingham'], linkSlotIds: [] },
    });
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          legalActions: [buildA, buildB],
          board: { locations: [{ id: 'birmingham', kind: 'industrial' }], links: [] },
        }),
      ),
    );
    await gameState.newGame(2, undefined);
    gameState.selectCard('industry:coal');

    const fixture = TestBed.createComponent(BoardMapComponent);
    fixture.detectChanges();

    const clickableCircle = fixture.nativeElement.querySelector('g.map-target-node circle:not(.pulse-ring)') as SVGCircleElement;
    clickableCircle.dispatchEvent(new Event('click', { bubbles: true }));

    expect(gameState.popup()?.actions.length).toBe(2);
    expect(gateway.submitAction).not.toHaveBeenCalled();
  });
});
