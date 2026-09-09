import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { GameAlreadyOverError, GameNotFoundError, InvalidActionIndexError } from '@brass/backend-application';

/**
 * Maps `GameService`'s domain errors (and anything else) onto the exact `{ error: string }`
 * JSON shape and status codes `src/web/server.ts` used to send by hand — so
 * `HttpGameGateway` on the frontend needs no changes.
 */
@Catch()
export class GameErrorsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof GameNotFoundError) {
      res.status(HttpStatus.NOT_FOUND).json({ error: exception.message });
      return;
    }
    if (exception instanceof GameAlreadyOverError || exception instanceof InvalidActionIndexError) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: exception.message });
      return;
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      res.status(exception.getStatus()).json({ error: Array.isArray(message) ? message.join('; ') : String(message ?? exception.message) });
      return;
    }
    const message = exception instanceof Error ? exception.message : String(exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
