export class MeasurementProgressDto {
  jobId: string;
  channel: number;
  total: number;
  percent: number;
  status: 'measuring' | 'completed' | 'error';
  message: string;
}

export class MeasurementCompletedDto {
  jobId: string;
  measurementId: number;
  takenAt: Date;
  totalPoints: number;
  data: any[];
}

export class MeasurementErrorDto {
  jobId: string;
  message: string;
}

