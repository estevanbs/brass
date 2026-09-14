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

  it('keeps the legend open on a large screen, but collapsed behind its toggle on a compact (phone) viewport', async () => {
    gateway.createGame.mockReturnValue(of(baseGameView({ board: { locations: [{ id: 'birmingham', kind: 'industrial' }], links: [] } })));
    await gameState.newGame(2, undefined);

    const large = TestBed.createComponent(BoardMapComponent);
    large.detectChanges();
    expect(large.nativeElement.querySelector('.map-legend')).not.toBeNull();

    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: () => ({ matches: true }) });
    try {
      const compact = TestBed.createComponent(BoardMapComponent);
      compact.detectChanges();
      expect(compact.nativeElement.querySelector('.map-legend')).toBeNull();

      (compact.nativeElement.querySelector('.legend-toggle') as HTMLButtonElement).click();
      compact.detectChanges();
      expect(compact.nativeElement.querySelector('.map-legend')).not.toBeNull();
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: original });
    }
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

    // Not just on hover — the score is also rendered directly on the map, next to the
    // built-owner marker at the link's midpoint.
    const svgTexts = Array.from(fixture.nativeElement.querySelectorAll('svg.map-svg text')) as SVGTextElement[];
    expect(svgTexts.some((t) => t.textContent === '4')).toBe(true);
  });

  // ---------- Mobile touch targets ----------
  // The board is the one place a small/imprecise tap matters most: nodes are drawn as an
  // r=11-15 circle (22-30px across) and links as a 1.6-4px line, both well under the ~44px
  // touch target Apple/Google recommend. These specs pin the invisible, larger hit-areas added
  // on top of those drawn shapes so a regression that shrinks or removes them is caught here
  // instead of only by someone actually failing to tap the board on a phone.
  // ---------- Resource-source picking (coal mine / iron works) ----------
  describe('resource-source picking', () => {
    function boardWithSources() {
      return {
        locations: [
          { id: 'birmingham', kind: 'industrial' as const },
          { id: 'dudley', kind: 'industrial' as const },
          { id: 'walsall', kind: 'industrial' as const },
        ],
        links: [],
      };
    }

    it('clicking a build target whose matches differ only by coal source enters resource-choice mode instead of opening the popup', async () => {
      const buildViaDudley = legalAction({
        index: 2,
        type: 'build',
        cardKeys: ['industry:coal'],
        targets: { locationIds: ['birmingham'], linkSlotIds: [] },
        coalSourceLocationIds: ['dudley'],
      });
      const buildViaWalsall = legalAction({
        index: 3,
        type: 'build',
        cardKeys: ['industry:coal'],
        targets: { locationIds: ['birmingham'], linkSlotIds: [] },
        coalSourceLocationIds: ['walsall'],
      });
      gateway.createGame.mockReturnValueOnce(
        of(baseGameView({ legalActions: [buildViaDudley, buildViaWalsall], board: boardWithSources() })),
      );
      await gameState.newGame(2, undefined);
      gameState.selectCard('industry:coal');

      const fixture = TestBed.createComponent(BoardMapComponent);
      fixture.detectChanges();

      const birminghamNode = Array.from(fixture.nativeElement.querySelectorAll('g')).find((g) =>
        (g as Element).textContent?.includes('birmingham'),
      ) as SVGGElement;
      birminghamNode.dispatchEvent(new Event('click', { bubbles: true }));

      expect(gameState.popup()).toBeNull();
      expect(gameState.resourceChoice()?.resourceKind).toBe('coal');
      expect(new Set(gameState.resourceChoice()?.options.keys())).toEqual(new Set(['dudley', 'walsall']));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.map-hint').textContent).toContain('mina');
    });

    it('marks the candidate mine/works tiles (not the original build target) as the clickable nodes once in resource-choice mode', async () => {
      const buildViaDudley = legalAction({
        index: 2,
        type: 'build',
        cardKeys: ['industry:coal'],
        targets: { locationIds: ['birmingham'], linkSlotIds: [] },
        coalSourceLocationIds: ['dudley'],
      });
      const buildViaWalsall = legalAction({
        index: 3,
        type: 'build',
        cardKeys: ['industry:coal'],
        targets: { locationIds: ['birmingham'], linkSlotIds: [] },
        coalSourceLocationIds: ['walsall'],
      });
      gateway.createGame.mockReturnValueOnce(
        of(baseGameView({ legalActions: [buildViaDudley, buildViaWalsall], board: boardWithSources() })),
      );
      await gameState.newGame(2, undefined);
      gameState.selectCard('industry:coal');
      gameState.chooseAction('birmingham', [buildViaDudley, buildViaWalsall], { mode: 'corner' });

      const fixture = TestBed.createComponent(BoardMapComponent);
      fixture.detectChanges();

      const clickableLabels = Array.from(fixture.nativeElement.querySelectorAll('g.map-target-node'))
        .map((g) => (g as Element).querySelector('text')?.textContent?.trim())
        .sort();
      expect(clickableLabels).toEqual(['dudley', 'walsall']);
      // Styled distinctly from a normal build target (green, not amber) — see RESOURCE_CHOICE_LINE.
      const resourceNode = Array.from(fixture.nativeElement.querySelectorAll('g.map-target-node')).find((g) =>
        (g as Element).textContent?.includes('dudley'),
      ) as SVGGElement;
      expect(resourceNode.classList.contains('map-resource-target')).toBe(true);
    });

    it('clicking the chosen mine tile narrows to the matching action and opens the confirm popup', async () => {
      const buildViaDudley = legalAction({
        index: 2,
        type: 'build',
        cardKeys: ['industry:coal'],
        targets: { locationIds: ['birmingham'], linkSlotIds: [] },
        coalSourceLocationIds: ['dudley'],
      });
      const buildViaWalsall = legalAction({
        index: 3,
        type: 'build',
        cardKeys: ['industry:coal'],
        targets: { locationIds: ['birmingham'], linkSlotIds: [] },
        coalSourceLocationIds: ['walsall'],
      });
      gateway.createGame.mockReturnValueOnce(
        of(baseGameView({ legalActions: [buildViaDudley, buildViaWalsall], board: boardWithSources() })),
      );
      await gameState.newGame(2, undefined);
      gameState.selectCard('industry:coal');
      gameState.chooseAction('birmingham', [buildViaDudley, buildViaWalsall], { mode: 'corner' });

      const fixture = TestBed.createComponent(BoardMapComponent);
      fixture.detectChanges();

      const dudleyNode = Array.from(fixture.nativeElement.querySelectorAll('g.map-target-node')).find((g) =>
        (g as Element).textContent?.includes('dudley'),
      ) as SVGGElement;
      dudleyNode.dispatchEvent(new Event('click', { bubbles: true }));

      expect(gameState.resourceChoice()).toBeNull();
      expect(gameState.popup()?.actions).toEqual([buildViaDudley]);
    });
  });

  describe('touch targets', () => {
    it('gives a clickable node an invisible hit-circle comfortably larger than the drawn one', async () => {
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

      const node = fixture.nativeElement.querySelector('g.map-target-node') as SVGGElement;
      const circles = Array.from(node.querySelectorAll('circle')) as SVGCircleElement[];
      const hitCircle = circles.find((c) => c.classList.contains('node-hit-target'));
      const drawnCircle = circles.find((c) => c.classList.contains('node-fill'));

      expect(hitCircle).toBeDefined();
      expect(drawnCircle).toBeDefined();
      const hitRadius = Number(hitCircle?.getAttribute('r'));
      const drawnRadius = Number(drawnCircle?.getAttribute('r'));
      // 2*hitRadius is the touch target's full width in SVG units — the map is rendered close
      // to 1:1 with CSS px, so this stands in for the ~44px minimum recommended touch target.
      expect(hitRadius).toBeGreaterThan(drawnRadius);
      expect(hitRadius * 2).toBeGreaterThanOrEqual(44);
    });

    it('does not add an invisible hit-circle to a node with no legal action', async () => {
      gateway.createGame.mockReturnValueOnce(
        of(baseGameView({ board: { locations: [{ id: 'birmingham', kind: 'industrial' }], links: [] } })),
      );
      await gameState.newGame(2, undefined);

      const fixture = TestBed.createComponent(BoardMapComponent);
      fixture.detectChanges();

      const node = fixture.nativeElement.querySelector('g') as SVGGElement;
      expect(node.querySelector('.node-hit-target')).toBeNull();
    });

    it('the click handler lives on the node group, so tapping the drawn (inner) circle directly also opens the popup', async () => {
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

      const node = fixture.nativeElement.querySelector('g.map-target-node') as SVGGElement;
      const drawnCircle = node.querySelector('.node-fill') as SVGCircleElement;

      drawnCircle.dispatchEvent(new Event('click', { bubbles: true }));

      expect(gameState.popup()?.actions).toEqual([buildAtBirmingham]);
    });

    it('gives a clickable (unbuilt) link an invisible wide hit-line on top of the thin drawn one', async () => {
      const buildLink = legalAction({
        index: 2,
        type: 'network',
        cardKeys: ['industry:coal'],
        targets: { locationIds: [], linkSlotIds: ['birmingham__oxford'] },
      });
      gateway.createGame.mockReturnValueOnce(
        of(
          baseGameView({
            legalActions: [buildLink],
            board: {
              locations: [
                { id: 'birmingham', kind: 'industrial' },
                { id: 'oxford', kind: 'industrial' },
              ],
              links: [{ id: 'birmingham__oxford', locations: ['birmingham', 'oxford'], bonusConnections: [], era: 'both' }],
            },
          }),
        ),
      );
      await gameState.newGame(2, undefined);
      gameState.selectCard('industry:coal');

      const fixture = TestBed.createComponent(BoardMapComponent);
      fixture.detectChanges();

      const lines = Array.from(fixture.nativeElement.querySelectorAll('svg.map-svg line')) as SVGLineElement[];
      const hitLine = lines.find((l) => l.classList.contains('link-hit-target'));
      expect(hitLine).toBeDefined();
      expect(Number(hitLine?.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(26);

      hitLine?.dispatchEvent(new Event('click', { bubbles: true }));
      expect(gameState.popup()?.actions).toEqual([buildLink]);
    });

    it('does not add an invisible hit-line for an already-built link', async () => {
      gateway.createGame.mockReturnValueOnce(
        of(
          baseGameView({
            board: {
              locations: [
                { id: 'birmingham', kind: 'industrial' },
                { id: 'oxford', kind: 'industrial' },
              ],
              links: [{ id: 'birmingham__oxford', locations: ['birmingham', 'oxford'], bonusConnections: [], era: 'both' }],
            },
            state: {
              ...baseGameView().state,
              links: [{ slotId: 'birmingham__oxford', owner: 'p1', kind: 'canal' }],
            },
          }),
        ),
      );
      await gameState.newGame(2, undefined);

      const fixture = TestBed.createComponent(BoardMapComponent);
      fixture.detectChanges();

      const lines = Array.from(fixture.nativeElement.querySelectorAll('svg.map-svg line')) as SVGLineElement[];
      expect(lines.some((l) => l.classList.contains('link-hit-target'))).toBe(false);
    });
  });
});
