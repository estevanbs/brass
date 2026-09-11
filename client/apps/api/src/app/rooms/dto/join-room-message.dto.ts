import { IsString } from 'class-validator';

export class JoinRoomMessageDto {
  @IsString()
  readonly code!: string;

  @IsString()
  readonly name!: string;
}
