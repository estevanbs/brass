import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { GameGateway, GameStateService } from '@brass/application';
import { FakeGameGateway, fakeGameGatewayProvider } from '../testing/fake-game-gateway';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  it('starts a new game with the chosen player count and seed', async () => {
    TestBed.configureTestingModule({ providers: [fakeGameGatewayProvider()] });
    const gateway = TestBed.inject(GameGateway) as FakeGameGateway;

    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    // With [ngValue] options, Angular's SelectControlValueAccessor tracks selection by option
    // index internally, not by the literal string value — so drive it via `selectedIndex`
    // rather than `select.value = '3'` (which bypasses that mapping and resets to "").
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.selectedIndex = 1; // options are 2, 3, 4 in order -> index 1 is "3"
    select.dispatchEvent(new Event('change'));
    const seedInput = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    seedInput.value = '42';
    seedInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    await vi.waitFor(() => expect(gateway.createGame).toHaveBeenCalledWith({ playerCount: 3, seed: 42 }));
  });

  it('shows the current status message from GameStateService while a game is being created', () => {
    TestBed.configureTestingModule({ providers: [fakeGameGatewayProvider()] });
    const gameState = TestBed.inject(GameStateService);
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    void gameState.newGame(2, undefined); // sets "Criando partida..." synchronously before the async gateway call resolves
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.status').textContent).toContain('Criando partida');
  });
});
