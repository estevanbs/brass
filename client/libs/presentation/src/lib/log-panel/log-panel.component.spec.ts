import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameGateway, GameStateService } from '@brass/application';
import { baseGameView, FakeGameGateway, fakeGameGatewayProvider } from '../testing/fake-game-gateway';
import { LogPanelComponent } from './log-panel.component';

describe('LogPanelComponent', () => {
  let gameState: GameStateService;
  let gateway: FakeGameGateway;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [fakeGameGatewayProvider()] });
    gameState = TestBed.inject(GameStateService);
    gateway = TestBed.inject(GameGateway) as FakeGameGateway;
  });

  it('is open by default, showing the log newest-first', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView({ log: ['primeiro', 'segundo', 'terceiro'] })));
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(LogPanelComponent);
    fixture.detectChanges();
    const lines = fixture.nativeElement.querySelectorAll('.log div');
    expect(Array.from(lines).map((l) => (l as HTMLElement).textContent)).toEqual(['terceiro', 'segundo', 'primeiro']);
  });

  it('can still be collapsed via the toggle button', async () => {
    gateway.createGame.mockReturnValueOnce(of(baseGameView({ log: ['primeiro'] })));
    await gameState.newGame(2, undefined);

    const fixture = TestBed.createComponent(LogPanelComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.log')).not.toBeNull();

    (fixture.nativeElement.querySelector('.log-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.log')).toBeNull();
  });
});
