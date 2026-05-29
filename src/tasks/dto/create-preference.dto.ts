import { IsString, IsOptional, IsUUID, IsNumber } from 'class-validator';

export class CreatePreferenceDto {
  @IsString()
  name: string;

  @IsUUID()
  analyzerDeviceId: string;

  @IsUUID()
  muxDeviceId: string;

  @IsNumber()
  startFreq: number;

  @IsNumber()
  stopFreq: number;

  @IsOptional()
  @IsNumber()
  points?: number;

  @IsOptional()
  @IsString()
  sweepType?: string;
}
