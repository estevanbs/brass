import { IsInt, IsOptional, IsString } from 'class-validator';

/** Payload of a `submitAction` WebSocket message — the WS equivalent of the old
 * `POST /api/games/:id/actions` body, plus `gameId` (no URL params over a socket). */
export class SubmitActionMessageDto {
  @IsString()
  readonly gameId!: string;

  @IsOptional()
  @IsInt()
  readonly index?: number;
}
