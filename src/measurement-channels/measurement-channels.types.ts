export interface MeasurementChannelResponse {
  channelNumber: number;
  channelAlias: string | null;
  concreteMix: number | null;
  hasEmulsifier: boolean;
  notes: string | null;
  sampleAge: number | null;
  temperature: number | null;
  humidity: number | null;
}

