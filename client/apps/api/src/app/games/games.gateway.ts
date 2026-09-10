import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Observable } from 'rxjs';
import { GameService } from '@brass/backend-application';
import { SubmitActionMessageDto } from './dto/submit-action-message.dto.js';
import { moveAppliedEvent, type ServerToClientEvent } from './ws-events.js';

/**
 * Replaces `POST /api/games/:id/actions`: instead of running every bot turn synchronously and
 * returning only the final state, this streams one `moveApplied` message per move as
 * `GameService.submitHumanAction`'s `onMove` callback fires — see `ws-events.ts` for the wire
 * protocol. Errors (same 3 as the old REST route: unknown game, game already over, invalid
 * index) become a single `error` message instead of an HTTP status code.
 */
@WebSocketGateway({ path: '/ws/games' })
export class GamesGateway {
  constructor(private readonly gameService: GameService) {}

  @SubscribeMessage('submitAction')
  submitAction(@MessageBody() body: SubmitActionMessageDto): Observable<ServerToClientEvent> {
    return new Observable<ServerToClientEvent>((subscriber) => {
      try {
        this.gameService.submitHumanAction(body.gameId, body.index, (event) => {
          subscriber.next(moveAppliedEvent(event));
        });
        subscriber.next({ type: 'sequenceComplete' });
      } catch (err) {
        subscriber.next({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      }
      subscriber.complete();
    });
  }
}
