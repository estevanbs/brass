import { Observable } from 'rxjs';
import type { GameMoveEvent, GameView, NewGameRequest } from '@brass/domain';
import { GameGateway } from '@brass/application';
import type { RoomConnection } from './room-connection';

/**
 * The online `GameGateway`: once a room has actually started (its `gameId` is known — see
 * `LazyRoomGameGateway`, the only place that constructs this), every call rides the *same*
 * shared `RoomConnection` the lobby itself used, correlated only by message *type* (there's no
 * per-request id in this protocol — every socket in a room gets every room event, which is
 * exactly what makes `watchMoves` work: another seat's move is just a `moveApplied` this
 * gateway didn't have to ask for).
 */
export class RoomGameGateway implements GameGateway {
  constructor(
    private readonly connection: RoomConnection,
    private readonly code: string,
    private readonly token: string,
    private readonly gameId: string,
  ) {}

  /** A room's game always already exists by the time this gateway is constructed — "creating"
   * one doesn't apply, so this just re-fetches the current view instead (harmless if a user
   * mistakenly reaches the offline "Novo jogo" control while actually in an online game). */
  createGame(_request: NewGameRequest): Observable<GameView> {
    return this.getGame(this.gameId);
  }

  getGame(_gameId: string): Observable<GameView> {
    return new Observable<GameView>((subscriber) => {
      const sub = this.connection.events$.subscribe((event) => {
        if (event.type === 'roomStarted') {
          subscriber.next(event.view);
          subscriber.complete();
        } else if (event.type === 'error') {
          subscriber.error(new Error(event.message));
        }
      });
      this.connection.send('reconnectRoom', { code: this.code, token: this.token });
      return () => sub.unsubscribe();
    });
  }

  submitAction(_gameId: string, actionIndex: number): Observable<GameMoveEvent> {
    return new Observable<GameMoveEvent>((subscriber) => {
      const sub = this.connection.events$.subscribe((event) => {
        if (event.type === 'moveApplied') {
          subscriber.next({ playerId: event.playerId, actionLabel: event.actionLabel, targets: event.targets, view: event.view });
        } else if (event.type === 'sequenceComplete') {
          subscriber.complete();
        } else if (event.type === 'error') {
          subscriber.error(new Error(event.message));
        }
      });
      this.connection.send('submitAction', { code: this.code, token: this.token, index: actionIndex });
      return () => sub.unsubscribe();
    });
  }

  /** Every `moveApplied` on the shared connection, indefinitely — including this client's own
   * (redundant with, but harmless alongside, what `submitAction`'s own call already applies;
   * Brass is strictly turn-based, so there is no real risk of two different seats' moves
   * racing on the wire at once). `sequenceComplete`/`error` are deliberately not surfaced here
   * — those belong to whichever `submitAction` call is actually in flight, not to this
   * long-lived feed. */
  watchMoves(_gameId: string): Observable<GameMoveEvent> {
    return new Observable<GameMoveEvent>((subscriber) => {
      const sub = this.connection.events$.subscribe((event) => {
        if (event.type === 'moveApplied') {
          subscriber.next({ playerId: event.playerId, actionLabel: event.actionLabel, targets: event.targets, view: event.view });
        }
      });
      return () => sub.unsubscribe();
    });
  }
}
