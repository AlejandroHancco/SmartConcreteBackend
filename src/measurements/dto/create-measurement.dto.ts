import { IsNumber, IsUUID, IsObject, IsString, IsOptional } from 'class-validator';

export class CreateMeasurementDto {
  @IsNumber()
  taskId: number;

  @IsUUID()
  takenBy: string;

  @IsNumber()
  startFreq: number;

  @IsNumber()
  stopFreq: number;

  @IsString()
  analyzerName: string;

  @IsString()
  analyzerIp: string;

  @IsString()
  muxName: string;

  @IsString()
  muxIp: string;

  @IsOptional()
  @IsNumber()
  taskPreferenceId?: number;

  @IsObject()
  data: any; // JSONB
}
