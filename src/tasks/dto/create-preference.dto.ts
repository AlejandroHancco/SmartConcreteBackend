import { IsString, IsOptional, IsUUID, IsNumber } from 'class-validator';

export class CreatePreferenceDto {
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
}
