import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameGateway, GameStateService } from '@brass/application';
import type { IndustryTileDef } from '@brass/domain';
import { baseGameView, FakeGameGateway, fakeGameGatewayProvider, player } from '../testing/fake-game-gateway';
import { PlayerMatComponent } from './player-mat.component';

function coalTile(level: 1 | 2 | 3 | 4, overrides: Partial<IndustryTileDef> = {}): IndustryTileDef {
  return {
    industry: 'coal',
    level,
    cost: 5,
    coalCost: 0,
    ironCost: 0,
    resourceProduced: 2,
    beerToSell: 0,
    victoryPoints: 1,
    incomeGain: 4,
    locked: false,
    ...overrides,
  };
}

describe('PlayerMatComponent', () => {
  let gameState: GameStateService;
  let gateway: FakeGameGateway;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [fakeGameGatewayProvider()] });
    gameState = TestBed.inject(GameStateService);
    gateway = TestBed.inject(GameGateway) as FakeGameGateway;
  });

  it('is open by default, and can still be collapsed via the toggle button', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView()));
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(PlayerMatComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mat-panel')).not.toBeNull();

    (fixture.nativeElement.querySelector('.mat-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mat-panel')).toBeNull();
  });

  it('starts collapsed on a compact (phone) viewport, where an open panel buried most of the board', async () => {
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: () => ({ matches: true }) });
    try {
      gateway.createGame.mockReturnValueOnce(of(baseGameView()));
      await gameState.newGame(2, undefined);

      const fixture = TestBed.createComponent(PlayerMatComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.mat-panel')).toBeNull();

      (fixture.nativeElement.querySelector('.mat-toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.mat-panel')).not.toBeNull();
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: original });
    }
  });

  it('defaults to the human player and shows a tab per player', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          humanId: 'p1',
          state: {
            ...baseGameView().state,
            turnOrder: ['p1', 'p2'],
            players: { p1: player({ id: 'p1' }), p2: player({ id: 'p2' }) },
          },
        }),
      ),
    );
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(PlayerMatComponent);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.mat-tabs button');
    expect(tabs.length).toBe(2);
    expect(tabs[0].classList.contains('active')).toBe(true);
    expect(tabs[0].textContent).toContain('você');
  });

  it('marks the front-of-stack tile as next and shows a chip per remaining tile', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          humanId: 'p1',
          industryTiles: [coalTile(1), coalTile(2)],
          state: {
            ...baseGameView().state,
            turnOrder: ['p1'],
            players: {
              p1: player({
                id: 'p1',
                industryStock: { coal: [1, 2], iron: [], cotton: [], manufacturer: [], pottery: [], brewery: [] },
              }),
            },
          },
        }),
      ),
    );
    await gameState.newGame(1, undefined);

    const fixture = TestBed.createComponent(PlayerMatComponent);
    fixture.detectChanges();

    const coalColumn = Array.from(fixture.nativeElement.querySelectorAll('.mat-industry')).find((el) =>
      (el as HTMLElement).textContent?.includes('coal'),
    ) as HTMLElement;
    const tiles = coalColumn.querySelectorAll('.mat-tile-row .mat-tile');
    expect(tiles.length).toBe(2);
    expect(tiles[0].classList.contains('next')).toBe(true);
    expect(tiles[1].classList.contains('next')).toBe(false);
  });

  it('shows victory points and income gain directly on the chip, not only in the hover title', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          humanId: 'p1',
          industryTiles: [coalTile(1, { victoryPoints: 3, incomeGain: 2 })],
          state: {
            ...baseGameView().state,
            turnOrder: ['p1'],
            players: {
              p1: player({
                id: 'p1',
                industryStock: { coal: [1], iron: [], cotton: [], manufacturer: [], pottery: [], brewery: [] },
              }),
            },
          },
        }),
      ),
    );
    await gameState.newGame(1, undefined);

    const fixture = TestBed.createComponent(PlayerMatComponent);
    fixture.detectChanges();

    const chipText = (fixture.nativeElement.querySelector('.mat-tile') as HTMLElement).textContent ?? '';
    expect(chipText).toContain('3pv');
    expect(chipText).toContain('+2r');
  });

  it('shows the coal or iron this tile also costs to build directly on the chip', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          humanId: 'p1',
          industryTiles: [
            coalTile(1, { industry: 'cotton', coalCost: 1 }),
            coalTile(1, { industry: 'manufacturer', ironCost: 1 }),
            coalTile(1, { industry: 'coal', coalCost: 0, ironCost: 0 }),
          ],
          state: {
            ...baseGameView().state,
            turnOrder: ['p1'],
            players: {
              p1: player({
                id: 'p1',
                industryStock: { coal: [1], iron: [], cotton: [1], manufacturer: [1], pottery: [], brewery: [] },
              }),
            },
          },
        }),
      ),
    );
    await gameState.newGame(1, undefined);

    const fixture = TestBed.createComponent(PlayerMatComponent);
    fixture.detectChanges();

    const columnText = (industry: string) =>
      (Array.from(fixture.nativeElement.querySelectorAll('.mat-industry')).find((el) =>
        (el as HTMLElement).textContent?.includes(industry),
      ) as HTMLElement).textContent ?? '';

    expect(columnText('cotton')).toContain('+1⚫');
    expect(columnText('manufacturer')).toContain('+1⛓');
    // Coal itself needs neither coal nor iron to build — no extra line for it.
    const coalChip = fixture.nativeElement.querySelector('.mat-tile-row .mat-tile') as HTMLElement;
    expect(coalChip.textContent).not.toContain('⚫');
    expect(coalChip.textContent).not.toContain('⛓');
  });

  it('also lists tiles already built on the board, with VP/renda for reference, separate from the remaining stock', async () => {
    gateway.createGame.mockReturnValueOnce(
      of(
        baseGameView({
          humanId: 'p1',
          industryTiles: [coalTile(1, { victoryPoints: 1, incomeGain: 1 }), coalTile(2, { victoryPoints: 2, incomeGain: 1 })],
          board: { locations: [{ id: 'dudley', kind: 'industrial' }], links: [] },
          state: {
            ...baseGameView().state,
            turnOrder: ['p1'],
            players: {
              p1: player({
                id: 'p1',
                industryStock: { coal: [2], iron: [], cotton: [], manufacturer: [], pottery: [], brewery: [] },
              }),
            },
            locations: {
              dudley: {
                id: 'dudley',
                kind: 'industrial',
                slots: [{ allowedIndustries: ['coal'], tile: { owner: 'p1', industry: 'coal', level: 1, flipped: false, resourceRemaining: 2 } }],
              },
            },
          },
        }),
      ),
    );
    await gameState.newGame(1, undefined);

    const fixture = TestBed.createComponent(PlayerMatComponent);
    fixture.detectChanges();

    const coalColumn = Array.from(fixture.nativeElement.querySelectorAll('.mat-industry')).find((el) =>
      (el as HTMLElement).textContent?.includes('coal'),
    ) as HTMLElement;

    // Still in stock: level 2.
    const stockTiles = coalColumn.querySelectorAll('.mat-tile-row .mat-tile:not(.built)');
    expect(stockTiles.length).toBe(1);
    expect(stockTiles[0].textContent).toContain('L2');

    // Already built: level 1, at dudley, not yet flipped.
    const builtTiles = coalColumn.querySelectorAll('.mat-tile.built');
    expect(builtTiles.length).toBe(1);
    expect(builtTiles[0].textContent).toContain('L1');
    expect(builtTiles[0].textContent).toContain('1pv');
    expect(builtTiles[0].textContent).toContain('+1r');
    expect(builtTiles[0].classList.contains('flipped')).toBe(false);
    expect((builtTiles[0] as HTMLElement).title).toContain('dudley');
  });
});
