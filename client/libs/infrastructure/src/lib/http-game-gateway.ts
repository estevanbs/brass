import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { GameMoveEvent, GameView, NewGameRequest } from '@brass/domain';
import { GameGateway } from '@brass/application';

/** The `/ws/games` wire protocol — see `apps/api/src/app/games/ws-events.ts` (the backend's
 * copy of the same shape; not shared code, same convention already used for `GameView`
 * itself, which mirrors the backend's `GameService#view` output by hand). */
type ServerToClientEvent =
  | { readonly type: 'moveApplied'; readonly playerId: string; readonly actionLabel: string; readonly targets: GameMoveEvent['targets']; readonly view: GameView }
  | { readonly type: 'sequenceComplete' }
  | { readonly type: 'error'; readonly message: string };

/**
 * The one adapter that actually talks to the backend, implementing the `GameGateway` port
 * that `application` depends on. Nothing outside this file (and the composition root that
 * wires it in) knows the transport — `createGame`/`getGame` are plain REST (`/api/games...`,
 * no bot moves happen before either of those can return), `submitAction` opens a WebSocket to
 * `/ws/games` and streams back one `GameMoveEvent` per move.
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

  submitAction(gameId: string, actionIndex: number): Observable<GameMoveEvent> {
    return new Observable<GameMoveEvent>((subscriber) => {
      const ws = new WebSocket(this.wsUrl());

      ws.onopen = () => {
        ws.send(JSON.stringify({ event: 'submitAction', data: { gameId, index: actionIndex } }));
      };
      ws.onmessage = (raw) => {
        const message = JSON.parse(raw.data as string) as ServerToClientEvent;
        if (message.type === 'moveApplied') {
          subscriber.next({ playerId: message.playerId, actionLabel: message.actionLabel, targets: message.targets, view: message.view });
        } else if (message.type === 'sequenceComplete') {
          subscriber.complete();
        } else {
          subscriber.error(new Error(message.message));
        }
      };
      ws.onerror = () => {
        subscriber.error(new Error('erro de conexão com o servidor'));
      };

      return () => ws.close();
    });
  }

  private wsUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/games`;
  }
}
