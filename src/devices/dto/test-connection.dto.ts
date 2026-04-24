import { IsEnum, IsString, IsOptional, IsNumber } from 'class-validator';

export class TestConnectionDto {
  @IsEnum(['analyzer', 'mux'])
  type: 'analyzer' | 'mux';

  @IsString()
  ip: string;

  @IsOptional()
  @IsNumber()
  port?: number;
}
