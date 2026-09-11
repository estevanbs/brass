import { IsString } from 'class-validator';

export class ReconnectRoomMessageDto {
  @IsString()
  readonly code!: string;

  @IsString()
  readonly token!: string;
}
