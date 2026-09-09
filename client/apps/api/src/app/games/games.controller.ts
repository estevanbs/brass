import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { GameService } from '@brass/backend-application';
import { CreateGameDto } from './dto/create-game.dto.js';
import { SubmitActionDto } from './dto/submit-action.dto.js';

/**
 * Same 3 routes `src/web/server.ts` used to serve directly over `node:http`
 * (`POST /api/games`, `GET /api/games/:id`, `POST /api/games/:id/actions`) — now just thin
 * HTTP adapters over `GameService` (`@brass/backend-application`), which owns the actual
 * orchestration logic unchanged. `@HttpCode(200)` on the POSTs matches the original server's
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

  @Post(':id/actions')
  @HttpCode(HttpStatus.OK)
  submitAction(@Param('id') id: string, @Body() body: SubmitActionDto): unknown {
    return this.gameService.submitHumanAction(id, body.index);
  }
}
