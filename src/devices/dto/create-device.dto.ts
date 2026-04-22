import { IsString, IsOptional } from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  ip?: string;
}
