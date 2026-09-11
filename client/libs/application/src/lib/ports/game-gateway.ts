import type { Observable } from 'rxjs';
import type { GameMoveEvent, GameView, NewGameRequest } from '@brass/domain';

/**
 * The port `GameStateService` talks to instead of a concrete HTTP client — an abstract class
 * so it can double as an Angular DI token (plain TS interfaces don't exist at runtime).
 * `application` depends only on this port, never on `infrastructure`; the composition root
 * (apps/web, per-route) is the only place that wires a concrete adapter to it. That inversion
 * is what lets `GameStateService` be unit-tested with a fake gateway and no real transport.
 */
export abstract class GameGateway {
  abstract createGame(request: NewGameRequest): Observable<GameView>;
  abstract getGame(gameId: string): Observable<GameView>;
  /** Emits one `GameMoveEvent` per move as the adapter streams them (the human's own move,
   * then one per bot move) and completes once it's the human's turn again or the game ends —
   * an `Observable<GameView>` that only ever surfaced the final state once every bot had
   * already played would lose that per-move detail. */
  abstract submitAction(gameId: string, actionIndex: number): Observable<GameMoveEvent>;
  /** A long-lived stream of every move applied to `gameId` by *any* seat, for gateways where
   * moves can happen without this client's own `submitAction` call — an online room with other
   * real players. A single-viewer gateway (offline vs. bots) never emits here: nothing there
   * ever moves except in direct response to this client's own `submitAction`, which already
   * reports it. `GameStateService` subscribes to this once per game, alongside (not instead
   * of) `submitAction`'s own stream. */
  abstract watchMoves(gameId: string): Observable<GameMoveEvent>;
}
