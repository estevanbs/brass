import type { Observable } from 'rxjs';
import type { GameView, NewGameRequest } from '@brass/domain';

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
  abstract submitAction(gameId: string, actionIndex: number): Observable<GameView>;
}
