import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { GameView, NewGameRequest } from '@brass/domain';
import { GameGateway } from '@brass/application';

/**
 * The one adapter that actually talks to the backend (src/web/server.ts's `/api/games*`
 * routes), implementing the `GameGateway` port that `application` depends on. Nothing outside
 * this file (and the composition root that wires it in) knows the transport is HTTP — a test
 * double or a future WebSocket adapter could replace it without touching `GameStateService`.
 */
@Injectable()
export class HttpGameGateway implements GameGateway {
  private readonly http = inject(HttpClient);

  createGame(request: NewGameRequest): Observable<GameView> {
    return this.http.post<GameView>('/api/games', request);
  }

  getGame(gameId: string): Observable<GameView> {
    return this.http.get<GameView>(`/api/games/${gameId}`);
  }

  submitAction(gameId: string, actionIndex: number): Observable<GameView> {
    return this.http.post<GameView>(`/api/games/${gameId}/actions`, { index: actionIndex });
  }
}
