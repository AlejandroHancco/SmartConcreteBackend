import { IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize, IsNumber, IsString, MaxLength, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class ChannelAlias {
  @IsNumber()
  channelNumber: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  alias: string;
}

export class UpdateChannelAliasBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(16)
  @Type(() => ChannelAlias)
  channels: ChannelAlias[];
}

