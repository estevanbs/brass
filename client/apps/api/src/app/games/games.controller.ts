import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { GameService } from '@brass/backend-application';
import { CreateGameDto } from './dto/create-game.dto.js';

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
    const playerCount = body.playerCount ?? 2;
    const seed = body.seed ?? Date.now() % 1_000_000;
    return this.gameService.createGame(playerCount, seed).view;
  }

  @Get(':id')
  getGame(@Param('id') id: string): unknown {
    return this.gameService.getView(id);
  }
}
