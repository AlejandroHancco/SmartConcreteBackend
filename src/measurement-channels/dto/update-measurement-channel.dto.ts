import { IsNumber, IsBoolean, IsString, IsInt, IsOptional, Min, Max, MaxLength } from 'class-validator';

export class UpdateMeasurementChannelDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  concreteMix?: number;

  @IsBoolean()
  @IsOptional()
  hasEmulsifier?: boolean;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sampleAge?: number;

  @IsNumber()
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  humidity?: number;
}

