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

export function moveAppliedEvent(event: MoveEvent): ServerToClientEvent {
  return { type: 'moveApplied', playerId: event.playerId, actionLabel: event.actionLabel, targets: event.targets, view: event.view };
}
