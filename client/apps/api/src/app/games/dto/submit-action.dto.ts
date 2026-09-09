import { IsInt, IsOptional } from 'class-validator';

export class SubmitActionDto {
  @IsOptional()
  @IsInt()
  readonly index?: number;
}
