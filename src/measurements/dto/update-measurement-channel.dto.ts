import { IsNumber, IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateMeasurementChannelDto {
  @IsOptional()
  @IsNumber()
  concreteMix?: number;

  @IsOptional()
  @IsBoolean()
  hasEmulsifier?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  sampleAge?: number;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  humidity?: number;
}

