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

  @IsUUID()
  projectId: string;
}
