export class MeasurementResponseDto {
  id: number;
  takenAt: Date;
  takenBy: string;
  startFreq: number;
  stopFreq: number;
  analyzerName: string;
  muxName: string;
}
