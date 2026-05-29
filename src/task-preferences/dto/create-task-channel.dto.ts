import { IsNumber, IsString } from 'class-validator';

export class CreateTaskChannelDto {
  @IsNumber()
  taskId: number;

  @IsNumber()
  channelNumber: number;

  @IsString()
  alias: string;
}

