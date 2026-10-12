import { IsInt, IsIn } from 'class-validator';

export class UpdateProjectMemberRoleDto {
  @IsInt()
  @IsIn([3, 4, 5], { message: 'roleId debe ser 3 (Gestor), 4 (Operario) o 5 (Visualizador)' })
  roleId: number;
}
