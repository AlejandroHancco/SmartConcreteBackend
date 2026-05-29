import { IsString, IsOptional } from 'class-validator';

export class UpdateTaskChannelDto {
  @IsOptional()
  @IsString()
  alias?: string;
}

