import type { ActionTargets, RoomView } from '@brass/backend-application';

/**
 * The `/ws/rooms` wire protocol — the online counterpart to the old `/ws/games`
 * (`apps/api/src/app/games/ws-events.ts`, removed along with `GamesController`/`GamesGateway`;
 * a room with one human seat and the rest bots covers that same "solo vs bots" case now).
 * Every event a client can trigger (`createRoom`, `joinRoom`, `reconnectRoom`, `startRoom`,
 * `submitAction`) replies only to the sender with `roomJoined`/`roomState`/`error` as
 * appropriate, except `roomState` (after a join), `roomStarted` (after start or reconnecting
 * into a started room) and `moveApplied`/`sequenceComplete` (after an action), which
 * `RoomsGateway` fans out to every socket currently connected to that room — each with its
 * *own* redacted `view` (`GameService#getView` per viewer), never one shared payload.
 */
export type RoomServerToClientEvent =
  | { readonly type: 'roomJoined'; readonly code: string; readonly token: string; readonly playerId: string }
  | { readonly type: 'roomState'; readonly room: RoomView }
  | { readonly type: 'roomStarted'; readonly gameId: string; readonly view: unknown }
  | { readonly type: 'moveApplied'; readonly playerId: string; readonly actionLabel: string; readonly targets: ActionTargets; readonly view: unknown }
  | { readonly type: 'sequenceComplete' }
  | { readonly type: 'error'; readonly message: string };

export function roomStateEvent(room: RoomView): RoomServerToClientEvent {
  return { type: 'roomState', room };
}
