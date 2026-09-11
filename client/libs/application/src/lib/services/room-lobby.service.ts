import { Injectable, computed, inject, signal } from '@angular/core';
import type { RoomServerToClientEvent, RoomView } from '@brass/domain';
import { RoomGateway } from '../ports/room-gateway';

const STORAGE_KEY = 'brass-online-room';

interface StoredRoom {
  readonly code: string;
  readonly token: string;
}

export type RoomLobbyStatus = 'idle' | 'lobby' | 'started' | 'error';

/**
 * State for the online lobby — creating or joining a room, waiting for the host to start it,
 * and (once started) exposing exactly what `LazyRoomGameGateway` needs to hand
 * `GameStateService` a real `GameGateway`. This is the room-lifecycle counterpart to
 * `GameStateService`: same "depend only on a port, stay unit-testable with a fake" shape, just
 * for the lobby phase instead of gameplay. Persists `{code, token}` to `localStorage` so
 * `tryResume` can recover this seat after a refresh or dropped connection.
 */
@Injectable()
export class RoomLobbyService {
  private readonly gateway = inject(RoomGateway);

  private readonly _status = signal<RoomLobbyStatus>('idle');
  private readonly _room = signal<RoomView | null>(null);
  private readonly _myPlayerId = signal<string | null>(null);
  private readonly _myToken = signal<string | null>(null);
  private readonly _errorMessage = signal('');

  readonly status = this._status.asReadonly();
  readonly room = this._room.asReadonly();
  readonly myPlayerId = this._myPlayerId.asReadonly();
  readonly myToken = this._myToken.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly isHost = computed(() => {
    const room = this._room();
    const me = this._myPlayerId();
    return room !== null && me !== null && room.hostId === me;
  });

  /** Whether the *current* outstanding request is `tryResume`'s own silent reconnect attempt,
   * as opposed to a `createRoom`/`joinRoom` the user explicitly asked for — both a failed
   * resume and a failed explicit join can come back as the exact same "sala não encontrada"/
   * "token inválido" message (no request id on this wire protocol to tell them apart), but
   * they must be handled differently: a resume failing means "silently show the create/join
   * form, nothing the user did was wrong"; an explicit join failing means "show them why". */
  private resumingFromStorage = false;

  constructor() {
    this.gateway.events$.subscribe((event) => this.handleEvent(event));
  }

  /** Attempts to resume a room this browser already joined, per `localStorage` — call once,
   * e.g. right when the online page activates, before showing the create/join form. Returns
   * whether an attempt was actually made (there was something stored to try). */
  tryResume(): boolean {
    const stored = this.readStored();
    if (stored === null) return false;
    this.resumingFromStorage = true;
    this.gateway.reconnectRoom(stored.code, stored.token);
    return true;
  }

  createRoom(hostName: string, maxPlayers: number): void {
    this.resumingFromStorage = false;
    this._errorMessage.set('');
    this.gateway.createRoom(hostName, maxPlayers);
  }

  joinRoom(code: string, name: string): void {
    this.resumingFromStorage = false;
    this._errorMessage.set('');
    this.gateway.joinRoom(code, name);
  }

  startRoom(): void {
    const room = this._room();
    const token = this._myToken();
    if (room === null || token === null) return;
    this.gateway.startRoom(room.code, token);
  }

  /** Dismisses an error and returns to the create/join form — used by the "voltar" control a
   * failed create/join/reconnect shows. */
  reset(): void {
    this._status.set('idle');
    this._errorMessage.set('');
    this._room.set(null);
    this._myPlayerId.set(null);
    this._myToken.set(null);
  }

  private handleEvent(event: RoomServerToClientEvent): void {
    switch (event.type) {
      case 'roomJoined': {
        this.resumingFromStorage = false;
        this._myPlayerId.set(event.playerId);
        this._myToken.set(event.token);
        this._status.set('lobby');
        this.storeRoom({ code: event.code, token: event.token });
        break;
      }
      case 'roomState': {
        this._room.set(event.room);
        break;
      }
      case 'roomStarted': {
        this._room.update((room) => (room === null ? room : { ...room, status: 'started', gameId: event.gameId }));
        this._status.set('started');
        break;
      }
      case 'error': {
        const wasResuming = this.resumingFromStorage;
        this.resumingFromStorage = false;
        if (wasResuming) {
          // The silent auto-resume attempt failed — the stored seat is gone or was never
          // ours. Nothing the user did was wrong, so fall back to the create/join form
          // quietly instead of greeting them with an error for an action they never took.
          this.clearStored();
          this._status.set('idle');
          return;
        }
        this._errorMessage.set(event.message);
        if (this._status() !== 'started') this._status.set('error');
        break;
      }
    }
  }

  private readStored(): StoredRoom | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw === null ? null : (JSON.parse(raw) as StoredRoom);
    } catch {
      return null;
    }
  }

  private storeRoom(stored: StoredRoom): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // localStorage can throw (private browsing, quota) — reconnection is best-effort.
    }
  }

  private clearStored(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best-effort, see storeRoom
    }
  }
}
