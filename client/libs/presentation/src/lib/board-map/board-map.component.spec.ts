import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
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

  it('clicking a node with exactly one matching action opens a confirm popup instead of submitting immediately', async () => {
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

    const clickableCircle = fixture.nativeElement.querySelector('g.map-target-node circle:not(.pulse-ring)') as SVGCircleElement;
    clickableCircle.dispatchEvent(new Event('click', { bubbles: true }));

    expect(gameState.popup()?.actions).toEqual([buildAtBirmingham]);
    expect(gateway.submitAction).not.toHaveBeenCalled();
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

  it('shows a built tile\'s level, VP, renda and remaining resource in its hover title, plus a visible counter badge while it has resource left', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          industryTiles: [
            { industry: 'coal', level: 1, cost: 5, coalCost: 0, ironCost: 0, resourceProduced: 2, beerToSell: 0, victoryPoints: 1, incomeGain: 1, locked: false, eraRestricted: true },
          ],
          board: { locations: [{ id: 'coalbrookdale', kind: 'industrial' }], links: [] },
          state: {
            ...baseGameView().state,
            locations: {
              coalbrookdale: {
                id: 'coalbrookdale',
                kind: 'industrial',
                slots: [
                  {
                    allowedIndustries: ['coal'],
                    tile: { owner: 'p1', industry: 'coal', level: 1, flipped: false, resourceRemaining: 2 },
                  },
                ],
              },
            },
          },
        }),
      ),
    );
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(BoardMapComponent);
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('svg.map-svg circle title') as SVGTitleElement;
    expect(title.textContent).toContain('coal nível 1 (p1)');
    expect(title.textContent).toContain('1VP');
    expect(title.textContent).toContain('renda +1');
    expect(title.textContent).toContain('restam 2/2 antes de virar');

    expect(fixture.nativeElement.querySelector('.tile-counter-text').textContent).toBe('2');
  });

  it('omits the remaining-resource counter once a tile has flipped', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          industryTiles: [
            { industry: 'coal', level: 1, cost: 5, coalCost: 0, ironCost: 0, resourceProduced: 2, beerToSell: 0, victoryPoints: 1, incomeGain: 1, locked: false, eraRestricted: true },
          ],
          board: { locations: [{ id: 'coalbrookdale', kind: 'industrial' }], links: [] },
          state: {
            ...baseGameView().state,
            locations: {
              coalbrookdale: {
                id: 'coalbrookdale',
                kind: 'industrial',
                slots: [
                  {
                    allowedIndustries: ['coal'],
                    tile: { owner: 'p1', industry: 'coal', level: 1, flipped: true, resourceRemaining: 0 },
                  },
                ],
              },
            },
          },
        }),
      ),
    );
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(BoardMapComponent);
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('svg.map-svg circle title') as SVGTitleElement;
    expect(title.textContent).toContain('VIRADA');
    expect(fixture.nativeElement.querySelector('.tile-counter-badge')).toBeNull();
  });

  it('shows the live "would score X VP now" preview in a built link\'s hover title', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          industryTiles: [
            { industry: 'coal', level: 1, cost: 5, coalCost: 0, ironCost: 0, resourceProduced: 2, beerToSell: 0, victoryPoints: 4, incomeGain: 1, locked: false, eraRestricted: true },
          ],
          board: {
            locations: [
              { id: 'birmingham', kind: 'industrial' },
              { id: 'oxford', kind: 'industrial' },
            ],
            links: [{ id: 'birmingham__oxford', locations: ['birmingham', 'oxford'], bonusConnections: [], era: 'both' }],
          },
          state: {
            ...baseGameView().state,
            locations: {
              birmingham: {
                id: 'birmingham',
                kind: 'industrial',
                slots: [{ allowedIndustries: ['coal'], tile: { owner: 'p1', industry: 'coal', level: 1, flipped: true, resourceRemaining: 0 } }],
              },
              oxford: { id: 'oxford', kind: 'industrial', slots: [] },
            },
            links: [{ slotId: 'birmingham__oxford', owner: 'p1', kind: 'canal' }],
          },
        }),
      ),
    );
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(BoardMapComponent);
    fixture.detectChanges();

    const lineTitle = fixture.nativeElement.querySelector('svg.map-svg line title') as SVGTitleElement;
    expect(lineTitle.textContent).toContain('construído (Canal)');
    expect(lineTitle.textContent).toContain('pontuaria 4VP agora');
  });
});
