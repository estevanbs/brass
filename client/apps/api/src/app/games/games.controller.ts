import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { GameSeat } from '@brass/backend-application';
import { GameService } from '@brass/backend-application';
import { CreateGameDto } from './dto/create-game.dto.js';

/** This single-viewer "vs bots via the server" route predates seat-aware `GameService` and
 * will be replaced by `RoomsGateway` once online rooms exist (a room with one human seat and
 * the rest filled with bots covers this exact case). Until then it keeps its old fixed-human
 * shape by always seating itself as `'você'`. */
const HUMAN_ID = 'você';

/**
 * Game lifecycle endpoints that stay plain request/response — creating a game (no bot moves
 * happen before the human's first turn, so there's nothing to stream) and fetching the current
 * state (e.g. to resync after a dropped WebSocket connection). Submitting an action moved to
 * `GamesGateway` (`/ws/games`), which streams one event per move instead of only the final
 * state once every bot has played. `@HttpCode(200)` matches the original `node:http` server's
 * `sendJson(res, 200, ...)` on every success response (Nest's own POST default is 201).
 */
@Controller('games')
export class GamesController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  createGame(@Body() body: CreateGameDto): unknown {
    const count = Math.max(2, Math.min(4, body.playerCount ?? 2));
    const seed = body.seed ?? Date.now() % 1_000_000;
    const seats: GameSeat[] = [
      { playerId: HUMAN_ID, isBot: false },
      ...Array.from({ length: count - 1 }, (_, i) => ({ playerId: `bot${i + 1}`, isBot: true })),
    ];
    const { id } = this.gameService.createGame(seats, seed);
    return this.gameService.getView(id, HUMAN_ID);
  }

  @Get(':id')
  getGame(@Param('id') id: string): unknown {
    return this.gameService.getView(id, HUMAN_ID);
  }
}
