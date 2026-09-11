import type { PlayerId } from '@brass/backend-domain';
import type { GameSeat } from './game.model.js';
import { GameService } from './game.service.js';
import { InvalidRoomTokenError, NotRoomHostError, RoomAlreadyStartedError, RoomFullError, RoomNotFoundError } from './room.errors.js';
import type { Room, RoomRepository, RoomStatus } from './room.model.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids reading mistakes when shared out loud or typed by hand
const CODE_LENGTH = 6;

function generateCode(): string {
  // `crypto.getRandomValues`, not `Math.random` — this project's lint rule bans `Math.random`
  // everywhere to keep engine state changes always traceable to the seeded `Rng`; a room code
  // never touches engine state, but the same "no unseeded Math.random" tool (already used for
  // game ids and room tokens via `crypto.randomUUID`) works here too.
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = '';
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

/** Appends " (2)", " (3)", ... until `name` doesn't collide with anything in `taken` — a
 * room's seat `playerId` doubles as the display name the whole existing UI already renders
 * verbatim (no separate "name" field anywhere in `GameState`), and `GameService#createGame`
 * requires every seat's `playerId` to be unique. */
function uniqueName(name: string, taken: ReadonlySet<string>): PlayerId {
  if (!taken.has(name)) return name;
  let n = 2;
  while (taken.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

export interface RoomSeatView {
  readonly playerId: PlayerId;
  readonly isBot: boolean;
}

export interface RoomView {
  readonly code: string;
  readonly maxPlayers: number;
  readonly status: RoomStatus;
  readonly hostId: PlayerId;
  readonly seats: readonly RoomSeatView[];
  readonly gameId?: string;
}

export interface CreatedRoom {
  readonly code: string;
  readonly token: string;
  readonly playerId: PlayerId;
}

export interface JoinedRoom {
  readonly token: string;
  readonly playerId: PlayerId;
}

/**
 * Application-layer orchestration for online rooms: creating one (the host's first seat),
 * letting more players join by code, reconnecting a dropped player by their private token, and
 * starting the actual game once the host is ready (filling any empty seats with bots). Once
 * started, a room is just a thin wrapper around a `GameService` game — every rule about legal
 * moves, turn order, or scoring still lives only in the engine `GameService` already wraps;
 * this class only ever decides *who is allowed to act as which seat*.
 */
export class RoomService {
  constructor(
    private readonly repository: RoomRepository,
    private readonly gameService: GameService,
  ) {}

  createRoom(hostName: string, maxPlayers: number): CreatedRoom {
    const max = Math.max(2, Math.min(4, maxPlayers));
    const token = crypto.randomUUID();
    const playerId = uniqueName(hostName, new Set());
    const room: Room = {
      code: this.freshCode(),
      maxPlayers: max,
      seats: [{ playerId, isBot: false, token }],
      status: 'lobby',
    };
    this.repository.set(room.code, room);
    return { code: room.code, token, playerId };
  }

  joinRoom(code: string, name: string): JoinedRoom {
    const room = this.repository.get(code);
    if (room === undefined) throw new RoomNotFoundError();
    if (room.status !== 'lobby') throw new RoomAlreadyStartedError();
    if (room.seats.length >= room.maxPlayers) throw new RoomFullError();

    const token = crypto.randomUUID();
    const playerId = uniqueName(name, new Set(room.seats.map((s) => s.playerId)));
    room.seats.push({ playerId, isBot: false, token });
    return { token, playerId };
  }

  /** Recovers which seat `token` belongs to — the one thing a dropped connection needs to
   * rejoin the same seat, in the lobby or mid-game alike. */
  reconnect(code: string, token: string): { playerId: PlayerId } {
    const room = this.repository.get(code);
    if (room === undefined) throw new RoomNotFoundError();
    const seat = room.seats.find((s) => s.token === token);
    if (seat === undefined) throw new InvalidRoomTokenError();
    return { playerId: seat.playerId };
  }

  /** Only the host — the room's first seat, proven by `hostToken` matching its token — may
   * call this. Fills every empty seat (up to `maxPlayers`) with a bot, named/deduped exactly
   * like a human join would be, then hands the final seat list to `GameService` to actually
   * start the game. */
  startRoom(code: string, hostToken: string): { gameId: string } {
    const room = this.repository.get(code);
    if (room === undefined) throw new RoomNotFoundError();
    if (room.status !== 'lobby') throw new RoomAlreadyStartedError();
    const host = room.seats[0];
    if (host === undefined || host.token !== hostToken) throw new NotRoomHostError();

    const taken = new Set(room.seats.map((s) => s.playerId));
    let botCount = 0;
    while (room.seats.length < room.maxPlayers) {
      botCount += 1;
      const playerId = uniqueName(`bot${botCount}`, taken);
      taken.add(playerId);
      room.seats.push({ playerId, isBot: true });
    }

    const seats: GameSeat[] = room.seats.map((s) => ({ playerId: s.playerId, isBot: s.isBot }));
    const { id } = this.gameService.createGame(seats, Date.now() % 1_000_000);
    room.status = 'started';
    room.gameId = id;
    return { gameId: id };
  }

  roomState(code: string): RoomView {
    const room = this.repository.get(code);
    if (room === undefined) throw new RoomNotFoundError();
    const host = room.seats[0];
    if (host === undefined) throw new RoomNotFoundError(); // unreachable: every room is created with a host seat
    return {
      code: room.code,
      maxPlayers: room.maxPlayers,
      status: room.status,
      hostId: host.playerId,
      seats: room.seats.map((s) => ({ playerId: s.playerId, isBot: s.isBot })),
      gameId: room.gameId,
    };
  }

  private freshCode(): string {
    let code = generateCode();
    while (this.repository.get(code) !== undefined) code = generateCode();
    return code;
  }
}
