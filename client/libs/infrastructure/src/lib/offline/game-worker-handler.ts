import type { PlayerId } from '@brass/backend-domain';
import { GameService, InMemoryGameRepository, type GameRepository, type GameSeat } from '@brass/backend-application';
import type { WorkerRequest, WorkerResponse } from './game-worker-protocol';

const HUMAN_ID: PlayerId = 'você';

export type WorkerEmit = (response: WorkerResponse) => void;

/**
 * The worker's actual request-handling logic — a plain class with no `self`/`postMessage` in
 * it, so it's unit-testable directly (call `handle`, inspect what `emit` receives) without a
 * real Worker runtime. `game.worker.ts` is the thin adapter that wires this to
 * `self.onmessage`/`self.postMessage`. Mirrors `GamesController` + `GamesGateway` on the
 * backend — same `GameService`, same single fixed human seat, same per-move streaming — just
 * reused directly instead of duplicated, and addressed by `requestId` over one shared channel
 * instead of one REST route plus one WebSocket path.
 */
export class GameWorkerHandler {
  private readonly service: GameService;

  constructor(repository: GameRepository = new InMemoryGameRepository()) {
    this.service = new GameService(repository);
  }

  handle(request: WorkerRequest, emit: WorkerEmit): void {
    try {
      switch (request.type) {
        case 'createGame': {
          const count = Math.max(2, Math.min(4, request.playerCount));
          const seed = request.seed ?? Date.now() % 1_000_000;
          const seats: GameSeat[] = [
            { playerId: HUMAN_ID, isBot: false },
            ...Array.from({ length: count - 1 }, (_, i) => ({ playerId: `bot${i + 1}`, isBot: true })),
          ];
          const { id } = this.service.createGame(seats, seed);
          emit({ type: 'view', requestId: request.requestId, view: this.service.getView(id, HUMAN_ID) });
          return;
        }
        case 'getGame': {
          emit({ type: 'view', requestId: request.requestId, view: this.service.getView(request.gameId, HUMAN_ID) });
          return;
        }
        case 'submitAction': {
          this.service.submitHumanAction(request.gameId, HUMAN_ID, request.index, (event) => {
            const view = this.service.getView(request.gameId, HUMAN_ID);
            emit({
              type: 'moveApplied',
              requestId: request.requestId,
              playerId: event.playerId,
              actionLabel: event.actionLabel,
              targets: event.targets,
              view,
            });
          });
          emit({ type: 'sequenceComplete', requestId: request.requestId });
          return;
        }
      }
    } catch (err) {
      emit({ type: 'error', requestId: request.requestId, message: err instanceof Error ? err.message : String(err) });
    }
  }
}
