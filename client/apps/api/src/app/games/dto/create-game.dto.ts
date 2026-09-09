import { IsInt, IsOptional } from 'class-validator';

export class CreateGameDto {
  @IsOptional()
  @IsInt()
  readonly playerCount?: number;

  @IsOptional()
  @IsInt()
  readonly seed?: number;
}
