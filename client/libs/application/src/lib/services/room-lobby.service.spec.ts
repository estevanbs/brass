import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomServerToClientEvent, RoomView } from '@brass/domain';
import { RoomGateway } from '../ports/room-gateway';
import { RoomLobbyService } from './room-lobby.service';

const STORAGE_KEY = 'brass-online-room';

function roomView(overrides: Partial<RoomView> = {}): RoomView {
  return {
    code: 'ABC123',
    maxPlayers: 3,
    status: 'lobby',
    hostId: 'Ana',
    seats: [{ playerId: 'Ana', isBot: false }],
    ...overrides,
  };
}

class FakeRoomGateway implements RoomGateway {
  readonly incoming = new Subject<RoomServerToClientEvent>();
  readonly events$ = this.incoming.asObservable();
  createRoom = vi.fn();
  joinRoom = vi.fn();
  reconnectRoom = vi.fn();
  startRoom = vi.fn();
}

describe('RoomLobbyService', () => {
  let gateway: FakeRoomGateway;
  let service: RoomLobbyService;

  beforeEach(() => {
    localStorage.clear();
    gateway = new FakeRoomGateway();
    TestBed.configureTestingModule({
      providers: [RoomLobbyService, { provide: RoomGateway, useValue: gateway }],
    });
    service = TestBed.inject(RoomLobbyService);
  });

  it('starts idle with no room', () => {
    expect(service.status()).toBe('idle');
    expect(service.room()).toBeNull();
    expect(service.isHost()).toBe(false);
  });

  it('createRoom forwards to the gateway', () => {
    service.createRoom('Ana', 3);
    expect(gateway.createRoom).toHaveBeenCalledWith('Ana', 3);
  });

  it('joinRoom forwards to the gateway', () => {
    service.joinRoom('ABC123', 'Beto');
    expect(gateway.joinRoom).toHaveBeenCalledWith('ABC123', 'Beto');
  });

  it('roomJoined stores this seat\'s identity, moves to "lobby", and persists {code, token}', () => {
    gateway.incoming.next({ type: 'roomJoined', code: 'ABC123', token: 'tok1', playerId: 'Ana' });

    expect(service.status()).toBe('lobby');
    expect(service.myPlayerId()).toBe('Ana');
    expect(service.myToken()).toBe('tok1');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({ code: 'ABC123', token: 'tok1' });
  });

  it('roomState updates the room snapshot, and isHost reflects it against myPlayerId', () => {
    gateway.incoming.next({ type: 'roomJoined', code: 'ABC123', token: 'tok1', playerId: 'Ana' });
    gateway.incoming.next({ type: 'roomState', room: roomView({ hostId: 'Ana', seats: [{ playerId: 'Ana', isBot: false }] }) });

    expect(service.room()?.seats).toEqual([{ playerId: 'Ana', isBot: false }]);
    expect(service.isHost()).toBe(true);
  });

  it('isHost is false for a non-host seat', () => {
    gateway.incoming.next({ type: 'roomJoined', code: 'ABC123', token: 'tok2', playerId: 'Beto' });
    gateway.incoming.next({ type: 'roomState', room: roomView({ hostId: 'Ana' }) });
    expect(service.isHost()).toBe(false);
  });

  it('roomStarted marks the room started and stores gameId, without losing the existing seats', () => {
    gateway.incoming.next({ type: 'roomJoined', code: 'ABC123', token: 'tok1', playerId: 'Ana' });
    gateway.incoming.next({ type: 'roomState', room: roomView() });
    gateway.incoming.next({ type: 'roomStarted', gameId: 'game-1', view: {} as never });

    expect(service.status()).toBe('started');
    expect(service.room()?.status).toBe('started');
    expect(service.room()?.gameId).toBe('game-1');
    expect(service.room()?.seats).toEqual([{ playerId: 'Ana', isBot: false }]);
  });

  it('startRoom sends the room code and this seat\'s token once both are known', () => {
    gateway.incoming.next({ type: 'roomJoined', code: 'ABC123', token: 'tok1', playerId: 'Ana' });
    gateway.incoming.next({ type: 'roomState', room: roomView() });

    service.startRoom();
    expect(gateway.startRoom).toHaveBeenCalledWith('ABC123', 'tok1');
  });

  it('startRoom is a no-op before a room is known', () => {
    service.startRoom();
    expect(gateway.startRoom).not.toHaveBeenCalled();
  });

  it('an unrelated error (room full) surfaces as an error status without clearing a stored room', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 'ABC123', token: 'tok1' }));
    gateway.incoming.next({ type: 'error', message: 'sala cheia' });

    expect(service.status()).toBe('error');
    expect(service.errorMessage()).toBe('sala cheia');
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('a "room not found" error clears the stored room and returns to idle', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 'ABC123', token: 'tok1' }));
    gateway.incoming.next({ type: 'error', message: 'sala não encontrada' });

    expect(service.status()).toBe('idle');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('an "invalid token" error clears the stored room and returns to idle', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 'ABC123', token: 'bad' }));
    gateway.incoming.next({ type: 'error', message: 'token inválido' });

    expect(service.status()).toBe('idle');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  describe('tryResume', () => {
    it('returns false and does nothing when nothing is stored', () => {
      expect(service.tryResume()).toBe(false);
      expect(gateway.reconnectRoom).not.toHaveBeenCalled();
    });

    it('sends reconnectRoom with the stored code/token and returns true', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: 'ABC123', token: 'tok1' }));
      expect(service.tryResume()).toBe(true);
      expect(gateway.reconnectRoom).toHaveBeenCalledWith('ABC123', 'tok1');
    });
  });

  it('reset returns to idle and clears the in-memory room state', () => {
    gateway.incoming.next({ type: 'error', message: 'sala cheia' });
    expect(service.status()).toBe('error');

    service.reset();
    expect(service.status()).toBe('idle');
    expect(service.errorMessage()).toBe('');
    expect(service.room()).toBeNull();
    expect(service.myPlayerId()).toBeNull();
  });
});
