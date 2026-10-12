import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Servicio compartido para el filtrado estricto por equipo.
 * CRÍTICO: un usuario nunca debe ver datos de otro equipo.
 */
@Injectable()
export class TeamScopeService {
  constructor(private prisma: PrismaService) {}

  /** teamId del usuario autenticado (membresía APPROVED) o ForbiddenException */
  async getTeamId(userId: string): Promise<string> {
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId, status: 'APPROVED' },
      select: { teamId: true },
    });

    if (!membership) {
      throw new ForbiddenException('No perteneces a ningún equipo');
    }
    return membership.teamId;
  }

  /** Filtro Prisma: proyectos donde hay miembros (APPROVED) del equipo */
  projectTeamWhere(teamId: string): Prisma.ProjectWhereInput {
    return {
      userProjectRoles: {
        some: {
          user: {
            teamMembers: {
              some: { teamId, status: 'APPROVED' },
            },
          },
        },
      },
    };
  }

  /** Filtro de proyectos del equipo del usuario. Lanza Forbidden si no tiene equipo. */
  async projectWhereForUser(userId: string): Promise<Prisma.ProjectWhereInput> {
    const teamId = await this.getTeamId(userId);
    return this.projectTeamWhere(teamId);
  }

  /** Verifica que el proyecto pertenezca al equipo del usuario */
  async assertProjectInTeam(userId: string, projectId: string): Promise<void> {
    const where = await this.projectWhereForUser(userId);
    const project = await this.prisma.project.findFirst({
      where: { uuid: projectId, ...where },
      select: { uuid: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  /** Verifica que la task pertenezca a un proyecto del equipo del usuario */
  async assertTaskInTeam(userId: string, taskId: number): Promise<void> {
    const where = await this.projectWhereForUser(userId);
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: where },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
  }

  /** Verifica que la medición pertenezca a una task del equipo del usuario */
  async assertMeasurementInTeam(userId: string, measurementId: number): Promise<void> {
    const where = await this.projectWhereForUser(userId);
    const measurement = await this.prisma.measurement.findFirst({
      where: { id: measurementId, task: { project: where } },
      select: { id: true },
    });
    if (!measurement) throw new NotFoundException('Measurement not found');
  }

  /** Verifica que el scheduled job pertenezca a una task del equipo del usuario */
  async assertScheduledJobInTeam(userId: string, jobId: number): Promise<void> {
    const where = await this.projectWhereForUser(userId);
    const job = await this.prisma.scheduledJob.findFirst({
      where: { id: jobId, task: { project: where } },
      select: { id: true },
    });
    if (!job) throw new NotFoundException('Scheduled job not found');
  }

  /** Verifica que el usuario pertenezca (APPROVED) al equipo indicado */
  async assertTeamAccess(userId: string, teamId: string): Promise<void> {
    const member = await this.prisma.teamMember.findFirst({
      where: { userId, teamId, status: 'APPROVED' },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException('No perteneces a este equipo');
    }
  }
}
