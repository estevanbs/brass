import type { ActionTargets, GameView } from './game-view.model';

/** Mirrors the backend's `RoomView`/`RoomSeatView` (`libs/backend-application/src/lib/room.service.ts`)
 * by hand — the same convention `GameView` already uses for `GameService#view`'s payload. */
export interface RoomSeatView {
  readonly playerId: string;
  readonly isBot: boolean;
}

export type RoomStatus = 'lobby' | 'started';

export interface RoomView {
  readonly code: string;
  readonly maxPlayers: number;
  readonly status: RoomStatus;
  readonly hostId: string;
  readonly seats: readonly RoomSeatView[];
  readonly gameId?: string;
}

/** The `/ws/rooms` wire protocol, mirrored by hand from the backend's own copy
 * (`apps/api/src/app/rooms/ws-events.ts`) — same convention `GameView` already uses. Lives in
 * `domain`, not `infrastructure`, because `application`'s `RoomGateway` port (implemented by
 * `infrastructure`'s `WsRoomGateway`) needs to reference it too, and `application` must never
 * depend on `infrastructure`. */
export type RoomServerToClientEvent =
  | { readonly type: 'roomJoined'; readonly code: string; readonly token: string; readonly playerId: string }
  | { readonly type: 'roomState'; readonly room: RoomView }
  | { readonly type: 'roomStarted'; readonly gameId: string; readonly view: GameView }
  | { readonly type: 'moveApplied'; readonly playerId: string; readonly actionLabel: string; readonly targets: ActionTargets; readonly view: GameView }
  | { readonly type: 'sequenceComplete' }
  | { readonly type: 'error'; readonly message: string };
