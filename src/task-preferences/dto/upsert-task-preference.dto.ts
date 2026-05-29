import { IsString, IsIP } from 'class-validator';

export class UpsertTaskPreferenceDto {
  @IsString()
  analyzerName: string;

  @IsIP()
  analyzerIp: string;

  @IsString()
  muxName: string;

  @IsIP()
  muxIp: string;
}
