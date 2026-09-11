import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomServerToClientEvent } from '@brass/domain';
import { GameGateway, RoomGateway, RoomLobbyService } from '@brass/application';
import { fakeGameGatewayProvider } from '../testing/fake-game-gateway';
import { OnlinePlayComponent } from './online-play.component';

class FakeRoomGateway implements RoomGateway {
  readonly incoming = new Subject<RoomServerToClientEvent>();
  readonly events$ = this.incoming.asObservable();
  createRoom = vi.fn();
  joinRoom = vi.fn();
  reconnectRoom = vi.fn();
  startRoom = vi.fn();
}

describe('OnlinePlayComponent', () => {
  let gateway: FakeRoomGateway;

  beforeEach(() => {
    gateway = new FakeRoomGateway();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [RoomLobbyService, { provide: RoomGateway, useValue: gateway }, fakeGameGatewayProvider()],
    });
  });

  it('shows the create/join forms before any room exists', () => {
    const fixture = TestBed.createComponent(OnlinePlayComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('.setup-card')).toHaveLength(2);
    expect(el.textContent).toContain('Criar sala');
    expect(el.textContent).toContain('Entrar em uma sala');
  });

  it('creating a room forwards the typed name and player count to the gateway', () => {
    const fixture = TestBed.createComponent(OnlinePlayComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const nameInput = el.querySelector('.setup-card input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Ana';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const createButton = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Criar sala'));
    createButton?.click();

    expect(gateway.createRoom).toHaveBeenCalledWith('Ana', 4);
  });

  it('renders the waiting room once a room exists, with an empty-seat placeholder and no start button for a guest', () => {
    const fixture = TestBed.createComponent(OnlinePlayComponent);
    fixture.detectChanges();

    gateway.incoming.next({ type: 'roomJoined', code: 'ABC123', token: 'tok2', playerId: 'Beto' });
    gateway.incoming.next({
      type: 'roomState',
      room: { code: 'ABC123', maxPlayers: 3, status: 'lobby', hostId: 'Ana', seats: [{ playerId: 'Ana', isBot: false }, { playerId: 'Beto', isBot: false }] },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('ABC123');
    expect(el.querySelectorAll('.room-seats li')).toHaveLength(3); // Ana, Beto, one empty seat
    expect(el.textContent).toContain('anfitrião');
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Iniciar partida'))).toBe(false);
    expect(el.textContent).toContain('Aguardando o anfitrião');
  });

  it('shows a start button for the host, which starts the room', () => {
    const fixture = TestBed.createComponent(OnlinePlayComponent);
    fixture.detectChanges();

    gateway.incoming.next({ type: 'roomJoined', code: 'ABC123', token: 'tok1', playerId: 'Ana' });
    gateway.incoming.next({ type: 'roomState', room: { code: 'ABC123', maxPlayers: 2, status: 'lobby', hostId: 'Ana', seats: [{ playerId: 'Ana', isBot: false }] } });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const startButton = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Iniciar partida'));
    expect(startButton).toBeDefined();
    startButton?.click();

    expect(gateway.startRoom).toHaveBeenCalledWith('ABC123', 'tok1');
  });

  it('renders the game shell once the room has started, with GameStateService actually loaded (not just the empty shell)', async () => {
    const fixture = TestBed.createComponent(OnlinePlayComponent);
    fixture.detectChanges();
    const fakeGameGateway = TestBed.inject(GameGateway) as unknown as { getGame: ReturnType<typeof vi.fn> };

    gateway.incoming.next({ type: 'roomJoined', code: 'ABC123', token: 'tok1', playerId: 'Ana' });
    gateway.incoming.next({ type: 'roomState', room: { code: 'ABC123', maxPlayers: 2, status: 'lobby', hostId: 'Ana', seats: [{ playerId: 'Ana', isBot: false }] } });
    gateway.incoming.next({ type: 'roomStarted', gameId: 'game-1', view: {} as never });
    fixture.detectChanges();
    // `loadGame` is async (awaits the gateway's Observable via `firstValueFrom`) even though
    // the fake gateway resolves synchronously-sourced data — `await`ing it always takes at
    // least one microtask turn, so the view isn't in yet on the very same synchronous tick.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    // The bug this guards against: `<brass-game-shell>` rendering is not enough on its own —
    // nothing populates `GameStateService#view` for the online flow unless something calls
    // `loadGame`, so a real game screen (`main.app-main`) only ever appears if that actually
    // happened.
    expect(fakeGameGateway.getGame).toHaveBeenCalledWith('game-1');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('brass-game-shell')).not.toBeNull();
    expect(el.querySelector('main.app-main')).not.toBeNull();
  });

  it('does not call loadGame again if roomState updates again after the game is already loaded', async () => {
    const fixture = TestBed.createComponent(OnlinePlayComponent);
    fixture.detectChanges();
    const fakeGameGateway = TestBed.inject(GameGateway) as unknown as { getGame: ReturnType<typeof vi.fn> };

    gateway.incoming.next({ type: 'roomJoined', code: 'ABC123', token: 'tok1', playerId: 'Ana' });
    gateway.incoming.next({ type: 'roomState', room: { code: 'ABC123', maxPlayers: 2, status: 'lobby', hostId: 'Ana', seats: [{ playerId: 'Ana', isBot: false }] } });
    gateway.incoming.next({ type: 'roomStarted', gameId: 'game-1', view: {} as never });
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(fakeGameGateway.getGame).toHaveBeenCalledTimes(1);

    // An unrelated roomState broadcast (e.g. a reconnect elsewhere) must not re-trigger loadGame.
    gateway.incoming.next({
      type: 'roomState',
      room: { code: 'ABC123', maxPlayers: 2, status: 'started', gameId: 'game-1', hostId: 'Ana', seats: [{ playerId: 'Ana', isBot: false }] },
    });
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(fakeGameGateway.getGame).toHaveBeenCalledTimes(1);
  });

  it('shows an error with a way back to the form', () => {
    const fixture = TestBed.createComponent(OnlinePlayComponent);
    fixture.detectChanges();

    gateway.incoming.next({ type: 'error', message: 'sala cheia' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('sala cheia');
    const backButton = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Voltar'));
    backButton?.click();
    fixture.detectChanges();

    expect(el.querySelectorAll('.setup-card')).toHaveLength(2);
  });

  it('attempts to resume a stored room on init', () => {
    localStorage.setItem('brass-online-room', JSON.stringify({ code: 'ABC123', token: 'tok1' }));
    const fixture = TestBed.createComponent(OnlinePlayComponent);
    fixture.detectChanges();

    expect(gateway.reconnectRoom).toHaveBeenCalledWith('ABC123', 'tok1');
  });
});
