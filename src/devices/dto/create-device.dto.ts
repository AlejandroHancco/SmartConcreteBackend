import { IsString, IsOptional, IsIn, IsNotEmpty, IsIP, MaxLength } from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsIn(['analyzer', 'mux'])
  @IsNotEmpty()
  type: string;

  @IsIP()
  @IsOptional()
  ip?: string;
}
