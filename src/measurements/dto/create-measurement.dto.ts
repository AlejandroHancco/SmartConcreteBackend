import { IsNumber, IsUUID, IsObject, IsString, IsOptional } from 'class-validator';

export class CreateMeasurementDto {
  @IsNumber()
  taskId: number;

  @IsUUID()
  takenBy: string;

  @IsOptional()
  @IsString()
  presetName?: string;

  @IsNumber()
  startFreq: number;

  @IsNumber()
  stopFreq: number;

  @IsNumber()
  points: number;

  @IsString()
  sweepType: string;

  @IsString()
  analyzerName: string;

  @IsString()
  analyzerIp: string;

  @IsString()
  muxName: string;

  @IsString()
  muxIp: string;


  @IsObject()
  data: any; // JSONB
}
