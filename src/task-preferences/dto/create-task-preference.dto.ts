import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TaskPreferenceRangeDto {
  @IsInt()
  @Min(0)
  order: number;

  @IsNumber()
  @Min(1)
  startFreq: number;

  @IsNumber()
  @Min(1)
  stopFreq: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(801)
  points?: number;

  @IsOptional()
  @IsIn(['LOG', 'LIN'])
  sweepType?: string;
}

export class CreateTaskPreferenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsUUID()
  analyzerDeviceId: string;

  @IsUUID()
  muxDeviceId: string;

  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TaskPreferenceRangeDto)
  ranges: TaskPreferenceRangeDto[];
}
