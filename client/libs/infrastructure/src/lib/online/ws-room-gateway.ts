import type { Observable } from 'rxjs';
import type { RoomServerToClientEvent } from '@brass/domain';
import { RoomGateway } from '@brass/application';
import { RoomConnection } from './room-connection';

/**
 * The concrete `RoomGateway`: a thin wrapper turning each lobby action into a `RoomConnection`
 * message. All the actual state/orchestration (what a `roomJoined`/`roomState`/`error` event
 * means) lives in `application`'s `RoomLobbyService`, which depends only on this port — not on
 * `RoomConnection` directly, so it stays unit-testable with a fake.
 */
export class WsRoomGateway implements RoomGateway {
  readonly events$: Observable<RoomServerToClientEvent>;

  constructor(private readonly connection: RoomConnection = new RoomConnection()) {
    this.events$ = connection.events$;
  }

  createRoom(hostName: string, maxPlayers: number): void {
    this.connection.send('createRoom', { hostName, maxPlayers });
  }

  joinRoom(code: string, name: string): void {
    this.connection.send('joinRoom', { code, name });
  }

  reconnectRoom(code: string, token: string): void {
    this.connection.send('reconnectRoom', { code, token });
  }

  startRoom(code: string, token: string): void {
    this.connection.send('startRoom', { code, token });
  }
}
