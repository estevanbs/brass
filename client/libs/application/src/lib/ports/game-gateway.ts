import type { Observable } from 'rxjs';
import type { GameMoveEvent, GameView, NewGameRequest } from '@brass/domain';

/**
 * The port `GameStateService` talks to instead of a concrete HTTP client — an abstract class
 * so it can double as an Angular DI token (plain TS interfaces don't exist at runtime).
 * `application` depends only on this port, never on `infrastructure`; the composition root
 * (apps/web) is the only place that wires a concrete adapter (`HttpGameGateway`) to it. That
 * inversion is what lets `GameStateService` be unit-tested with a fake gateway and no HTTP.
 */
export abstract class GameGateway {
  abstract createGame(request: NewGameRequest): Observable<GameView>;
  abstract getGame(gameId: string): Observable<GameView>;
  /** Emits one `GameMoveEvent` per move as the backend streams them over `/ws/games` (the
   * human's own move, then one per bot move) and completes once it's the human's turn again
   * or the game ends — replacing the old single-response `Observable<GameView>` that only ever
   * surfaced the final state once every bot had already played. */
  abstract submitAction(gameId: string, actionIndex: number): Observable<GameMoveEvent>;
}
