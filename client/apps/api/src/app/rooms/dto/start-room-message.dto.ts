import { IsString } from 'class-validator';

export class StartRoomMessageDto {
  @IsString()
  readonly code!: string;

  @IsString()
  readonly token!: string;
}
