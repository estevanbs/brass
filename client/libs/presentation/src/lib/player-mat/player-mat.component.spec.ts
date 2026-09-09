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

  it('is collapsed until the toggle button is clicked', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView()));
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(PlayerMatComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mat-panel')).toBeNull();

    (fixture.nativeElement.querySelector('.mat-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mat-panel')).not.toBeNull();
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
    (fixture.nativeElement.querySelector('.mat-toggle') as HTMLButtonElement).click();
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
    (fixture.nativeElement.querySelector('.mat-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    const coalColumn = Array.from(fixture.nativeElement.querySelectorAll('.mat-industry')).find((el) =>
      (el as HTMLElement).textContent?.includes('coal'),
    ) as HTMLElement;
    const tiles = coalColumn.querySelectorAll('.mat-tile');
    expect(tiles.length).toBe(2);
    expect(tiles[0].classList.contains('next')).toBe(true);
    expect(tiles[1].classList.contains('next')).toBe(false);
  });
});
