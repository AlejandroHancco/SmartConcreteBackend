export interface ChannelResponse {
  channelNumber: number;
  alias: string;
}

export interface TaskChannelResponse {
  channelNumber: number;
  alias: string;
  concreteMix: number | null;
  hasEmulsifier: boolean | null;
  notes: string | null;
  sampleAge: number | null;
  temperature: number | null;
  humidity: number | null;
}

