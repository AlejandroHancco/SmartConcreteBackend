import { IsEnum, IsOptional, IsString, IsArray, Min, Max, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FreqRangeDto {
  @IsNumber()
  @Min(1)
  startFreq: number;

  @IsNumber()
  @Min(1)
  stopFreq: number;

  @IsNumber()
  @Min(1)
  @Max(801)
  points: number;

  @IsEnum(['LOG', 'LIN'])
  sweepType: 'LOG' | 'LIN';
}

export class MeasureDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FreqRangeDto)
  ranges: FreqRangeDto[];

  @IsArray()
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(16, { each: true })
  selectedChannels: number[];

  @IsOptional()
  @IsString()
  jobId?: string;
}
