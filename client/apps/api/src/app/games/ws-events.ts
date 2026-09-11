import type { ActionTargets, MoveEvent } from '@brass/backend-application';

/**
 * The WebSocket wire protocol for `/ws/games`, replacing the old
 * `POST /api/games/:id/actions` (which only ever returned the final state once every bot had
 * already played). Client sends one `submitAction` message; server streams back one
 * `moveApplied` per move actually applied (the human's own move first, then one per bot move,
 * in order), then a single `sequenceComplete` — or, on failure, a single `error` instead.
 */
export type ServerToClientEvent =
  | { readonly type: 'moveApplied'; readonly playerId: string; readonly actionLabel: string; readonly targets: ActionTargets; readonly view: unknown }
  | { readonly type: 'sequenceComplete' }
  | { readonly type: 'error'; readonly message: string };

/** `view` is the recipient's own (redacted) view as of right after this move — `MoveEvent`
 * itself carries no view because different recipients need different views of the same move
 * (a room's `RoomsGateway` will call `GameService#getView` once per connected socket instead
 * of once here); this single-viewer gateway just does that once, immediately. */
export function moveAppliedEvent(event: MoveEvent, view: unknown): ServerToClientEvent {
  return { type: 'moveApplied', playerId: event.playerId, actionLabel: event.actionLabel, targets: event.targets, view };
}
