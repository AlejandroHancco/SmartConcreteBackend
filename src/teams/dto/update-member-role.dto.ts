import { IsEnum } from 'class-validator';
import { TeamRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @IsEnum(TeamRole, { message: 'role debe ser ADMIN o MEMBER' })
  role: TeamRole;
}
