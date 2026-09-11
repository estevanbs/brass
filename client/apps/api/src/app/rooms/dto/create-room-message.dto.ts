import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateRoomMessageDto {
  @IsString()
  readonly hostName!: string;

  @IsOptional()
  @IsInt()
  readonly maxPlayers?: number;
}
