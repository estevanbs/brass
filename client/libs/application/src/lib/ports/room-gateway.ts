import type { Observable } from 'rxjs';
import type { RoomServerToClientEvent } from '@brass/domain';

/**
 * The port `RoomLobbyService` talks to for everything room-lifecycle related — create, join,
 * reconnect, start — mirroring `GameGateway`'s role for gameplay itself, but for the online
 * lobby phase that happens *before* a room's `GameGateway` (`RoomGameGateway`, wired up
 * separately once the room has actually started) even makes sense. An abstract class for the
 * same reason `GameGateway` is: it doubles as an Angular DI token.
 */
export abstract class RoomGateway {
  /** Every message the server sends back, multiplexed on one shared connection — not
   * call-scoped, since a room's state can change from messages this client didn't send (e.g.
   * another player joining or moving). */
  abstract readonly events$: Observable<RoomServerToClientEvent>;
  abstract createRoom(hostName: string, maxPlayers: number): void;
  abstract joinRoom(code: string, name: string): void;
  abstract reconnectRoom(code: string, token: string): void;
  abstract startRoom(code: string, token: string): void;
}
