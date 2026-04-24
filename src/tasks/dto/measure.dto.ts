import { IsNumber, IsEnum } from 'class-validator';

export class MeasureDto {
  @IsNumber()
  startFreq: number;

  @IsNumber()
  stopFreq: number;

  @IsNumber()
  points: number;

  @IsEnum(['LOG', 'LIN'])
  sweepType: 'LOG' | 'LIN';
}
