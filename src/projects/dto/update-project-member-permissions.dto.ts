import { IsArray, IsString } from 'class-validator';

export class UpdateProjectMemberPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
