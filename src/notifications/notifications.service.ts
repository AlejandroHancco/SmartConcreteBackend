import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KronosGateway } from '../gateway/kronos.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: KronosGateway,
  ) {}

  /** Crea la notificación in-app en DB y la emite por WebSocket si el usuario está conectado */
  private async createAndEmit(data: {
    userId: string;
    title: string;
    message: string;
    type: string;
    createdAt?: Date;
  }) {
    const notification = await this.prisma.notification.create({ data });
    this.gateway.emitNotification(data.userId, notification);
    return notification;
  }

  async notifyMemberApproved(userId: string, teamName: string) {
    return this.createAndEmit({
      userId,
      title: 'Solicitud aprobada',
      message: `Has sido aprobado en ${teamName}`,
      type: 'TEAM_APPROVED',
    });
  }

  async notifyMemberRejected(userId: string, teamName: string, attemptsLeft: number) {
    return this.createAndEmit({
      userId,
      title: 'Solicitud rechazada',
      message: `Tu solicitud en ${teamName} fue rechazada. Te quedan ${attemptsLeft} intentos.`,
      type: 'TEAM_REJECTED',
    });
  }

  async notifyAdminNewRequest(adminId: string, userName: string, teamName: string) {
    return this.createAndEmit({
      userId: adminId,
      title: 'Nueva solicitud',
      message: `${userName} quiere unirse a ${teamName}`,
      type: 'TEAM_JOIN_REQUEST',
    });
  }

  // ── Alertas de mediciones ("Kronos Watcher") — broadcast a todo el equipo ──

  private async getApprovedTeamMemberIds(teamId: string): Promise<string[]> {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId, status: 'APPROVED' },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  async notifyTeamMeasurementSuccess(
    teamId: string,
    projectName: string,
    deviceNames: string[],
  ) {
    let message = `Medición correcta en "${projectName}"`;
    if (deviceNames.length > 0) {
      message += `\n${deviceNames.join(', ')}`;
    }

    const createdAt = new Date();
    const memberIds = await this.getApprovedTeamMemberIds(teamId);
    await Promise.all(
      memberIds.map((userId) =>
        this.createAndEmit({
          userId,
          title: 'Medición correcta',
          message,
          type: 'MEASUREMENT_COMPLETE',
          createdAt,
        }),
      ),
    );
  }

  async notifyTeamMeasurementWarning(
    teamId: string,
    projectName: string,
    deviceNames: string[],
    reason: string,
  ) {
    let message = `Advertencia al medir en "${projectName}": ${reason}`;
    if (deviceNames.length > 0) {
      message += `\n${deviceNames.join(', ')}`;
    }

    const createdAt = new Date();
    const memberIds = await this.getApprovedTeamMemberIds(teamId);
    await Promise.all(
      memberIds.map((userId) =>
        this.createAndEmit({
          userId,
          title: 'Advertencia en medición',
          message,
          type: 'MEASUREMENT_WARNING',
          createdAt,
        }),
      ),
    );
  }

  async notifyTeamMeasurementFailed(
    teamId: string,
    projectName: string,
    deviceNames: string[],
    errorMessage: string,
    /** true: usa `errorMessage` tal cual, sin prefijo ni dispositivos (ej. "No se recibieron datos de medición"). */
    bare = false,
  ) {
    let message = bare ? errorMessage : `Ocurrió un error al medir en "${projectName}": ${errorMessage}`;
    if (!bare && deviceNames.length > 0) {
      message += `\n${deviceNames.join(', ')}`;
    }

    const createdAt = new Date();
    const memberIds = await this.getApprovedTeamMemberIds(teamId);
    await Promise.all(
      memberIds.map((userId) =>
        this.createAndEmit({
          userId,
          title: 'Error al medir',
          message,
          type: 'MEASUREMENT_FAILED',
          createdAt,
        }),
      ),
    );
  }

  /**
   * Feed de actividad reciente del equipo (mediciones correctas/warning/fallidas), deduplicado:
   * como se crea una fila por miembro, se colapsan las filas que comparten
   * título + mensaje + instante de creación en un solo evento.
   */
  async findRecentActivityForTeam(teamId: string, limit = 10) {
    const memberIds = await this.getApprovedTeamMemberIds(teamId);
    if (memberIds.length === 0) return [];

    const rows = await this.prisma.notification.findMany({
      where: {
        userId: { in: memberIds },
        type: { in: ['MEASUREMENT_COMPLETE', 'MEASUREMENT_WARNING', 'MEASUREMENT_FAILED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit * memberIds.length,
    });

    const seen = new Set<string>();
    const deduped: typeof rows = [];
    for (const row of rows) {
      const key = `${row.type}-${row.title}-${row.message}-${row.createdAt.getTime()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
      if (deduped.length >= limit) break;
    }

    return deduped;
  }

  // ── Endpoints de lectura ─────────────────────────────────────────────────

  async findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async countUnread(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { unread: count };
  }

  async markAsRead(id: number, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { message: 'Todas las notificaciones marcadas como leídas' };
  }
}
