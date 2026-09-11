import type { PlayerId } from '@brass/backend-domain';

export interface RoomSeat {
  readonly playerId: PlayerId;
  readonly isBot: boolean;
  /** Only human seats have one — proves "reconnect me as this seat" and, for the first seat
   * specifically, "I'm the host, let me start the room". Never set for a bot seat, since
   * nothing ever connects back to one. */
  readonly token?: string;
}

export type RoomStatus = 'lobby' | 'started';

export interface Room {
  readonly code: string;
  readonly maxPlayers: number;
  seats: RoomSeat[];
  status: RoomStatus;
  /** Set once `RoomService#startRoom` runs — the id of the `GameService` game this room plays. */
  gameId?: string;
}

/** Port for where rooms live — `InMemoryRoomRepository` today, swappable later without
 * touching `RoomService`. Mirrors `GameRepository`/`InMemoryGameRepository`. */
export interface RoomRepository {
  get(code: string): Room | undefined;
  set(code: string, room: Room): void;
}

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  set(code: string, room: Room): void {
    this.rooms.set(code, room);
  }
}
