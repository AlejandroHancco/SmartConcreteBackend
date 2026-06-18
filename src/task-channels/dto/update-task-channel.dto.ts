import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateTaskChannelDto {
  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  alias: string;

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
