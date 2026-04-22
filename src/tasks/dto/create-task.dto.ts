import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  points?: number;

  @IsNumber()
  startFreq: number;

  @IsNumber()
  stopFreq: number;

  @IsUUID()
  projectId: string;
}
