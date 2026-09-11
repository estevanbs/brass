import type { Observable } from 'rxjs';
import type { GameMoveEvent, GameView, NewGameRequest } from '@brass/domain';
import { GameGateway, RoomLobbyService } from '@brass/application';
import type { RoomConnection } from './room-connection';
import { RoomGameGateway } from './room-game-gateway';

/**
 * `GameShellComponent` (via `GameStateService`) needs a `GameGateway` the instant its route
 * activates — but for an online room, the concrete pieces a real `RoomGameGateway` needs (the
 * room's code, this seat's token, and its `gameId`) only exist once the lobby flow (driven by
 * `RoomLobbyService`, a *different*, earlier-activated port) has actually finished. This class
 * bridges that gap: it satisfies the `GameGateway` DI token from the moment the `/online` route
 * activates, but only builds (and then caches) a real `RoomGameGateway` the first time one of
 * its methods is actually called — which the online page's own template guarantees never
 * happens before `RoomLobbyService#status` is `'started'`.
 */
export class LazyRoomGameGateway implements GameGateway {
  private real: RoomGameGateway | undefined;

  constructor(
    private readonly lobby: RoomLobbyService,
    private readonly connection: RoomConnection,
  ) {}

  createGame(request: NewGameRequest): Observable<GameView> {
    return this.resolve().createGame(request);
  }

  getGame(gameId: string): Observable<GameView> {
    return this.resolve().getGame(gameId);
  }

  submitAction(gameId: string, actionIndex: number): Observable<GameMoveEvent> {
    return this.resolve().submitAction(gameId, actionIndex);
  }

  watchMoves(gameId: string): Observable<GameMoveEvent> {
    return this.resolve().watchMoves(gameId);
  }

  private resolve(): RoomGameGateway {
    if (this.real !== undefined) return this.real;
    const room = this.lobby.room();
    const token = this.lobby.myToken();
    const gameId = room?.gameId;
    if (room === null || token === null || gameId === undefined) {
      throw new Error('a sala ainda não iniciou a partida');
    }
    this.real = new RoomGameGateway(this.connection, room.code, token, gameId);
    return this.real;
  }
}
