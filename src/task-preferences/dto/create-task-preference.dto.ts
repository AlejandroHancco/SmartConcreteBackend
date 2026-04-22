import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class CreateTaskPreferenceDto {
  @IsNumber()
  taskId: number;

  @IsString()
  analyzerName: string;

  @IsString()
  analyzerIp: string;

  @IsOptional()
  @IsUUID()
  analyzerDeviceId?: string;

  @IsString()
  muxName: string;

  @IsString()
  muxIp: string;

  @IsOptional()
  @IsUUID()
  muxDeviceId?: string;

  @IsNumber()
  startFreq: number;

  @IsNumber()
  stopFreq: number;

  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
