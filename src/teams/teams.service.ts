import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamRole, MemberStatus } from '@prisma/client';
import { NormalizedUser } from '../auth/interfaces/auth.interface';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  /**
   * POST /teams/join - Unirse a un equipo con código
   */
  async joinTeam(code: string, user: NormalizedUser) {
    // Verificar si el usuario está baneado
    const dbUser = await this.prisma.user.findUnique({
      where: { uuid: user.id },
    });

    if (dbUser?.banned) {
      throw new ForbiddenException('Tu cuenta ha sido suspendida');
    }

    // Buscar el equipo por código
    const team = await this.prisma.team.findUnique({
      where: { code },
    });

    if (!team) {
      throw new BadRequestException('Código inválido');
    }

    // Verificar si el usuario ya es miembro aprobado
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: user.id,
          teamId: team.id,
        },
      },
    });

    if (existingMember && existingMember.status === 'APPROVED') {
      throw new BadRequestException('Ya eres miembro');
    }

    // Si existe y está rechazado o pendiente, actualizar a pendiente
    if (existingMember) {
      await this.prisma.teamMember.update({
        where: {
          id: existingMember.id,
        },
        data: {
          status: 'PENDING',
        },
      });
    } else {
      // Crear nuevo TeamMember con status PENDING
      await this.prisma.teamMember.create({
        data: {
          userId: user.id,
          teamId: team.id,
          status: 'PENDING',
          role: 'MEMBER',
        },
      });
    }

    return {
      message: 'Solicitud enviada',
      status: 'PENDING',
    };
  }

  /**
   * GET /teams/my-status - Obtener estado del usuario en su equipo
   */
  async getMyStatus(user: NormalizedUser) {
    const dbUser = await this.prisma.user.findUnique({
      where: { uuid: user.id },
    });

    if (!dbUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Buscar la membresía más reciente del usuario (por createdAt desc)
    const teamMember = await this.prisma.teamMember.findFirst({
      where: { userId: user.id },
      include: { team: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      status: (teamMember?.status as string) ?? 'NONE',
      rejectionCount: dbUser.rejectionCount,
      banned: dbUser.banned,
      team: teamMember?.team
        ? { id: teamMember.team.id, name: teamMember.team.name, code: teamMember.team.code }
        : null,
    };
  }

  /**
   * GET /teams/requests - Obtener solicitudes pendientes (solo ADMIN)
   */
  async getPendingRequests(user: NormalizedUser) {
    // Verificar que sea ADMIN en su equipo
    const adminMember = await this.prisma.teamMember.findFirst({
      where: {
        userId: user.id,
        role: 'ADMIN',
        status: 'APPROVED',
      },
      include: { team: true },
    });

    if (!adminMember) {
      throw new ForbiddenException('No tienes permisos para ver solicitudes');
    }

    // Obtener las solicitudes pendientes del equipo
    const requests = await this.prisma.teamMember.findMany({
      where: {
        teamId: adminMember.teamId,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            uuid: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return requests.map((member) => ({
      userId: member.user.uuid,
      userName: member.user.name,
      userEmail: member.user.email,
      status: member.status,
      createdAt: member.createdAt,
    }));
  }

  async getTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });

    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

     return team;
  }


  async getMembers(teamId: string) {
    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: { user: { select: { uuid: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateMemberRole(teamId: string, userId: string, role: TeamRole) {
    const member = await this.prisma.teamMember.findFirst({ where: { teamId, userId } });
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.teamMember.update({ where: { id: member.id }, data: { role } });
  }

  async removeMember(teamId: string, userId: string) {
    const member = await this.prisma.teamMember.findFirst({ where: { teamId, userId } });
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.teamMember.delete({ where: { id: member.id } });
  }

  async approveMember(teamId: string, userId: string, adminUser: NormalizedUser) {
    // Verificar que el admin sea ADMIN del equipo
    const adminMember = await this.prisma.teamMember.findFirst({
      where: {
        userId: adminUser.id,
        role: 'ADMIN',
        status: 'APPROVED',
      },
    });

    if (!adminMember) {
      throw new ForbiddenException('No tienes permisos para aprobar solicitudes');
    }

    // Buscar el miembro a aprobar en el mismo equipo
    const memberToApprove = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        teamId: adminMember.teamId,
      },
    });

    if (!memberToApprove) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    // Actualizar status a APPROVED
    const updated = await this.prisma.teamMember.update({
      where: { id: memberToApprove.id },
      data: { status: 'APPROVED' },
      include: { user: true, team: true },
    });

    return {
      message: 'Solicitud aprobada',
      member: {
        userId: updated.user.uuid,
        userName: updated.user.name,
        status: updated.status,
      },
    };
  }

  async rejectMember(teamId: string, userId: string, adminUser: NormalizedUser) {
    // Verificar que el admin sea ADMIN del equipo
    const adminMember = await this.prisma.teamMember.findFirst({
      where: {
        userId: adminUser.id,
        role: 'ADMIN',
        status: 'APPROVED',
      },
    });

    if (!adminMember) {
      throw new ForbiddenException('No tienes permisos para rechazar solicitudes');
    }

    // Buscar el miembro a rechazar en el mismo equipo
    const memberToReject = await this.prisma.teamMember.findFirst({
      where: {
        userId,
        teamId: adminMember.teamId,
      },
    });

    if (!memberToReject) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    // Incrementar rejectionCount
    const updatedUser = await this.prisma.user.update({
      where: { uuid: userId },
      data: { rejectionCount: { increment: 1 } },
    });

    const shouldBan = updatedUser.rejectionCount >= 3;

    if (shouldBan) {
      await this.prisma.user.update({
        where: { uuid: userId },
        data: { banned: true },
      });
      await this.prisma.teamMember.update({
        where: { id: memberToReject.id },
        data: { status: 'BANNED' },
      });
    } else {
      await this.prisma.teamMember.update({
        where: { id: memberToReject.id },
        data: { status: 'REJECTED' },
      });
    }

    return {
      message: 'Solicitud rechazada',
      userRejectionCount: updatedUser.rejectionCount,
      banned: shouldBan,
    };
  }

  async getTeamProjects(teamId: string) {
    const members = await this.prisma.teamMember.findMany({ where: { teamId, status: MemberStatus.APPROVED }, select: { userId: true } });
    const userIds = members.map((m) => m.userId);
    if (userIds.length === 0) return [];

    return this.prisma.project.findMany({
      where: { userProjectRoles: { some: { userId: { in: userIds } } } },
      select: { uuid: true, name: true, status: true, createdAt: true },
    });
  }

  async getTeamActivity(teamId: string) {
    const members = await this.prisma.teamMember.findMany({ where: { teamId, status: MemberStatus.APPROVED }, select: { userId: true } });
    const userIds = members.map((m) => m.userId);
    if (userIds.length === 0) return [];

    const measurements = await this.prisma.measurement.findMany({
      where: { takenBy: { in: userIds } },
      orderBy: { takenAt: 'desc' },
      take: 50,
      include: {
        takenByUser: { select: { name: true } },
        task: { select: { name: true } },
      },
    });

    return measurements.map((m) => ({
      memberName: m.takenByUser?.name ?? null,
      taskName: m.task?.name ?? null,
      takenAt: m.takenAt,
      analyzerName: m.analyzerName,
      points: m.points,
    }));
  }

  async getMyTeam(userId: string) {
    const member = await this.prisma.teamMember.findFirst({
      where: { userId, status: MemberStatus.APPROVED },
      include: { team: true },
    });

    if (!member) {
      throw new NotFoundException('No team found for this user');
    }

    return member.team;
  }
}

