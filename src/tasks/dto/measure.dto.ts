import {IsNumber, IsEnum, IsOptional, IsString, IsArray, Min, Max} from 'class-validator';

export class MeasureDto {
  @IsNumber()
  startFreq: number;

  @IsNumber()
  stopFreq: number;

  @IsNumber()
  points: number;

  @IsEnum(['LOG', 'LIN'])
  sweepType: 'LOG' | 'LIN';

  @IsArray()
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(16, { each: true })
  selectedChannels: number[];

  @IsOptional()
  @IsString()
  jobId?: string;
}
