import { IsString, MaxLength, IsNotEmpty } from 'class-validator';

export class UpdateChannelAliasDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  alias: string;
}

