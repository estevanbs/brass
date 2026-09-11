import type { ActionTargets } from '@brass/domain';

/**
 * The `postMessage` wire protocol between `InProcessGameGateway` (main thread) and
 * `game.worker.ts` (the Worker running the engine) — the offline counterpart to
 * `apps/api/src/app/games/ws-events.ts`'s WebSocket protocol, same shape philosophy (one
 * `moveApplied` per move, then `sequenceComplete`, or a single `error`), just addressed by
 * `requestId` since a single Worker instance serves every call over one shared channel instead
 * of one connection per request.
 */
export interface WorkerCreateGameRequest {
  readonly type: 'createGame';
  readonly requestId: string;
  readonly playerCount: number;
  readonly seed?: number;
}

export interface WorkerGetGameRequest {
  readonly type: 'getGame';
  readonly requestId: string;
  readonly gameId: string;
}

export interface WorkerSubmitActionRequest {
  readonly type: 'submitAction';
  readonly requestId: string;
  readonly gameId: string;
  readonly index: number;
}

export type WorkerRequest = WorkerCreateGameRequest | WorkerGetGameRequest | WorkerSubmitActionRequest;

export interface WorkerViewResponse {
  readonly type: 'view';
  readonly requestId: string;
  readonly view: unknown;
}

export interface WorkerMoveAppliedResponse {
  readonly type: 'moveApplied';
  readonly requestId: string;
  readonly playerId: string;
  readonly actionLabel: string;
  readonly targets: ActionTargets;
  readonly view: unknown;
}

export interface WorkerSequenceCompleteResponse {
  readonly type: 'sequenceComplete';
  readonly requestId: string;
}

export interface WorkerErrorResponse {
  readonly type: 'error';
  readonly requestId: string;
  readonly message: string;
}

export type WorkerResponse = WorkerViewResponse | WorkerMoveAppliedResponse | WorkerSequenceCompleteResponse | WorkerErrorResponse;
