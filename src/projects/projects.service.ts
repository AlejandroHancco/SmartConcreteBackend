import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamScopeService } from '../common/team-scope.service';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { NormalizedUser } from '../auth/interfaces/auth.interface';

const ROLE_ADMIN_ID = 2;           // Administrador de Equipo
const ROLE_PROJECT_MANAGER_ID = 3; // Gestor de Proyecto

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private teamScope: TeamScopeService,
    private permissionsService: PermissionsService,
  ) {}

  async create(createProjectDto: CreateProjectDto, creatorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({ data: createProjectDto });
      await tx.userProjectRole.create({
        data: { userId: creatorUserId, projectId: project.uuid, roleId: ROLE_ADMIN_ID },
      });
      return project;
    });
  }

  async findByTeam(userId: string) {
    const teamWhere = await this.teamScope.projectWhereForUser(userId);

    return this.prisma.project.findMany({
      where: teamWhere,
      select: {
        uuid: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        _count: { select: { devices: true, tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(uuid: string, userId: string) {
    const teamWhere = await this.teamScope.projectWhereForUser(userId);
    const project = await this.prisma.project.findFirst({
      where: { uuid, ...teamWhere },
      include: {
        devices: true,
        tasks: {
          select: { id: true, name: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(uuid: string, updateProjectDto: UpdateProjectDto, userId: string) {
    await this.teamScope.assertProjectInTeam(userId, uuid);
    return this.prisma.project.update({ where: { uuid }, data: updateProjectDto });
  }

  async remove(uuid: string, caller: NormalizedUser) {
    await this.teamScope.assertProjectInTeam(caller.id, uuid);
    const adminMember = await this.prisma.teamMember.findFirst({
      where: { userId: caller.id, role: 'ADMIN', status: 'APPROVED' },
    });
    if (!adminMember) {
      throw new ForbiddenException('Solo un ADMIN del equipo puede eliminar proyectos');
    }
    return this.prisma.project.delete({ where: { uuid } });
  }

  async countProjectsByRole(userId: string, roleName: string): Promise<number> {
    return this.prisma.userProjectRole.count({
      where: {
        userId,
        role: { name: roleName },
        project: { status: 'active' },
      },
    });
  }

  async getProjectMembers(projectId: string, userId: string) {
    await this.teamScope.assertProjectInTeam(userId, projectId);
    const uprs = await this.prisma.userProjectRole.findMany({
      where: { projectId },
      include: {
        user: { select: { uuid: true, name: true, email: true } },
        role: { select: { id: true, name: true } },
      },
    });

    const extras = await this.prisma.userProjectPermission.findMany({
      where: { projectId },
      select: { userId: true, permissionId: true },
    });
    const extrasByUser = new Map<string, string[]>();
    for (const e of extras) {
      extrasByUser.set(e.userId, [...(extrasByUser.get(e.userId) ?? []), e.permissionId]);
    }

    return uprs.map((upr) => ({
      userId: upr.user.uuid,
      name: upr.user.name,
      email: upr.user.email,
      roleId: upr.role.id,
      roleName: upr.role.name,
      extraPermissions: extrasByUser.get(upr.user.uuid) ?? [],
    }));
  }

  async updateProjectMemberPermissions(
    projectId: string,
    targetUserId: string,
    permissions: string[],
    caller: NormalizedUser,
  ) {
    await this.teamScope.assertProjectInTeam(caller.id, projectId);
    await this.permissionsService.assertCanManageMemberPermissions(
      caller.id,
      projectId,
      targetUserId,
      permissions,
    );
    const result = await this.permissionsService.setExtraPermissions(
      targetUserId,
      projectId,
      permissions,
    );
    return { userId: targetUserId, projectId, extraPermissions: result };
  }

  async updateProjectMemberRole(
    projectId: string,
    targetUserId: string,
    roleId: number,
    caller: NormalizedUser,
  ) {
    await this.teamScope.assertProjectInTeam(caller.id, projectId);

    const [callerProjectRole, callerTeamMembership] = await Promise.all([
      this.prisma.userProjectRole.findUnique({
        where: { userId_projectId: { userId: caller.id, projectId } },
        select: { roleId: true },
      }),
      this.prisma.teamMember.findFirst({
        where: { userId: caller.id, role: 'ADMIN', status: 'APPROVED' },
      }),
    ]);

    const isTeamAdmin = !!callerTeamMembership;
    const isProjectManager = callerProjectRole?.roleId === ROLE_PROJECT_MANAGER_ID;

    if (!isTeamAdmin && !isProjectManager) {
      throw new ForbiddenException(
        'Solo un ADMIN del equipo o Gestor de Proyecto puede asignar roles de proyecto',
      );
    }

    const result = await this.prisma.userProjectRole.upsert({
      where: { userId_projectId: { userId: targetUserId, projectId } },
      update: { roleId },
      create: { userId: targetUserId, projectId, roleId },
    });

    // Invalidar caché de permisos del usuario afectado inmediatamente
    await this.permissionsService.invalidateUserCache(targetUserId);

    return result;
  }
}
