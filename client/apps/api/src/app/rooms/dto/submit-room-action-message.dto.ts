import { IsInt, IsOptional, IsString } from 'class-validator';

export class SubmitRoomActionMessageDto {
  @IsString()
  readonly code!: string;

  @IsString()
  readonly token!: string;

  @IsOptional()
  @IsInt()
  readonly index?: number;
}
