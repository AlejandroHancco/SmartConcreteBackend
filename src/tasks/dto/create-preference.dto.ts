import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, IsNumber, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class FrequencyRangeDto {
  @IsInt() @Min(1) order: number;
  @IsNumber() @Min(1) startFreq: number;
  @IsNumber() @Min(1) stopFreq: number;
  @IsOptional() @IsInt() @Min(1) @Max(801) points?: number;
  @IsOptional() @IsIn(['LOG', 'LIN']) sweepType?: string;
}

export class CreatePreferenceDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsUUID() analyzerDeviceId: string;
  @IsUUID() muxDeviceId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => FrequencyRangeDto) ranges: FrequencyRangeDto[];
}
