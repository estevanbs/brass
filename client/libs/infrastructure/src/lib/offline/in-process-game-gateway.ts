import { EMPTY, Observable, type Subscriber } from 'rxjs';
import type { GameMoveEvent, GameView, NewGameRequest } from '@brass/domain';
import { GameGateway } from '@brass/application';
import type { WorkerRequest, WorkerResponse } from './game-worker-protocol';

export type WorkerFactory = () => Worker;

function defaultWorkerFactory(): Worker {
  return new Worker(new URL('./game.worker', import.meta.url), { type: 'module' });
}

let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  return `req${requestCounter}`;
}

/**
 * The offline `GameGateway`: runs the exact same `GameService` the backend uses (via
 * `GameWorkerHandler`), inside a Web Worker so the ISMCTS bot's synchronous search doesn't
 * freeze the UI. One Worker per gateway instance, kept alive for the lifetime of the offline
 * session; every call rides the same `postMessage` channel, correlated by `requestId` so a
 * response can only ever resolve the subscriber that actually asked for it.
 *
 * Deliberately not `@Injectable()`: its constructor takes a plain `WorkerFactory` function,
 * not an Angular-resolvable token, so it's always wired via `useFactory` (see
 * `app.routes.ts`), never `useClass` — which is also what keeps it easy to unit-test with a
 * fake `Worker`.
 */
export class InProcessGameGateway implements GameGateway {
  private readonly worker: Worker;

  constructor(workerFactory: WorkerFactory = defaultWorkerFactory) {
    this.worker = workerFactory();
  }

  createGame(request: NewGameRequest): Observable<GameView> {
    return this.request(
      { type: 'createGame', requestId: nextRequestId(), playerCount: request.playerCount, seed: request.seed },
      (response, subscriber) => {
        if (response.type === 'view') {
          subscriber.next(response.view as GameView);
          subscriber.complete();
        } else if (response.type === 'error') {
          subscriber.error(new Error(response.message));
        }
      },
    );
  }

  getGame(gameId: string): Observable<GameView> {
    return this.request({ type: 'getGame', requestId: nextRequestId(), gameId }, (response, subscriber) => {
      if (response.type === 'view') {
        subscriber.next(response.view as GameView);
        subscriber.complete();
      } else if (response.type === 'error') {
        subscriber.error(new Error(response.message));
      }
    });
  }

  submitAction(gameId: string, actionIndex: number): Observable<GameMoveEvent> {
    return this.request({ type: 'submitAction', requestId: nextRequestId(), gameId, index: actionIndex }, (response, subscriber) => {
      if (response.type === 'moveApplied') {
        subscriber.next({ playerId: response.playerId, actionLabel: response.actionLabel, targets: response.targets, view: response.view as GameView });
      } else if (response.type === 'sequenceComplete') {
        subscriber.complete();
      } else if (response.type === 'error') {
        subscriber.error(new Error(response.message));
      }
    });
  }

  /** Offline is always a single viewer — nothing here ever moves except in direct response to
   * this client's own `submitAction`, which already reports it, so there's never anything
   * extra to watch for. */
  watchMoves(_gameId: string): Observable<GameMoveEvent> {
    return EMPTY;
  }

  private request<T>(req: WorkerRequest, onResponse: (response: WorkerResponse, subscriber: Subscriber<T>) => void): Observable<T> {
    return new Observable<T>((subscriber) => {
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.requestId !== req.requestId) return;
        onResponse(event.data, subscriber);
      };
      this.worker.addEventListener('message', onMessage);
      this.worker.postMessage(req);
      return () => this.worker.removeEventListener('message', onMessage);
    });
  }
}
