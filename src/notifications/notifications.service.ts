import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KronosGateway } from '../gateway/kronos.gateway';

const MEASUREMENT_EVENT_TYPES = ['MEASUREMENT_COMPLETE', 'MEASUREMENT_WARNING', 'MEASUREMENT_FAILED'];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: KronosGateway,
  ) {}

  /**
   * Registra un ActivityEvent (siempre — es el log del equipo) y, si se indican
   * destinatarios, crea su fila de bandeja personal y les emite por WebSocket.
   * No todo evento notifica a alguien: eso lo decide cada método de arriba.
   */
  private async logEvent(params: {
    teamId: string;
    type: string;
    title: string;
    message: string;
    createdAt?: Date;
    notifyUserIds?: string[];
  }) {
    const event = await this.prisma.activityEvent.create({
      data: {
        teamId: params.teamId,
        type: params.type,
        title: params.title,
        message: params.message,
        createdAt: params.createdAt,
      },
    });

    const notifyUserIds = params.notifyUserIds ?? [];
    if (notifyUserIds.length > 0) {
      await this.prisma.activityEventRecipient.createMany({
        data: notifyUserIds.map((userId) => ({ eventId: event.id, userId })),
        skipDuplicates: true,
      });
      for (const userId of notifyUserIds) {
        this.gateway.emitNotification(userId, {
          id: event.id,
          type: event.type,
          title: event.title,
          message: event.message,
          read: false,
          createdAt: event.createdAt,
        });
      }
    }

    return event;
  }

  // ── Membresía de equipo (personal, un solo destinatario) ───────────────────

  async notifyMemberApproved(userId: string, teamId: string, teamName: string) {
    await this.logEvent({
      teamId,
      type: 'TEAM_APPROVED',
      title: 'Solicitud aprobada',
      message: `Has sido aprobado en ${teamName}`,
      notifyUserIds: [userId],
    });
  }

  async notifyMemberRejected(userId: string, teamId: string, teamName: string, attemptsLeft: number) {
    await this.logEvent({
      teamId,
      type: 'TEAM_REJECTED',
      title: 'Solicitud rechazada',
      message: `Tu solicitud en ${teamName} fue rechazada. Te quedan ${attemptsLeft} intentos.`,
      notifyUserIds: [userId],
    });
  }

  async notifyAdminNewRequest(adminId: string, teamId: string, userName: string, teamName: string) {
    await this.logEvent({
      teamId,
      type: 'TEAM_JOIN_REQUEST',
      title: 'Nueva solicitud',
      message: `${userName} quiere unirse a ${teamName}`,
      notifyUserIds: [adminId],
    });
  }

  // ── Alertas de mediciones ("Kronos Watcher") — log de equipo + notifica a todos ──

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

    const memberIds = await this.getApprovedTeamMemberIds(teamId);
    await this.logEvent({
      teamId,
      type: 'MEASUREMENT_COMPLETE',
      title: 'Medición correcta',
      message,
      notifyUserIds: memberIds,
    });
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

    const memberIds = await this.getApprovedTeamMemberIds(teamId);
    await this.logEvent({
      teamId,
      type: 'MEASUREMENT_WARNING',
      title: 'Advertencia en medición',
      message,
      notifyUserIds: memberIds,
    });
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

    const memberIds = await this.getApprovedTeamMemberIds(teamId);
    await this.logEvent({
      teamId,
      type: 'MEASUREMENT_FAILED',
      title: 'Error al medir',
      message,
      notifyUserIds: memberIds,
    });
  }

  /**
   * Feed de actividad reciente del equipo (mediciones correctas/warning/fallidas).
   * Una fila = un evento real — ya no hace falta deduplicar nada.
   */
  async findRecentActivityForTeam(teamId: string, limit = 10) {
    return this.prisma.activityEvent.findMany({
      where: { teamId, type: { in: MEASUREMENT_EVENT_TYPES } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Log completo de actividad del equipo (todos los tipos de evento, paginado).
   * A diferencia de la bandeja personal, aquí no hay noción de "leído": es el
   * historial crudo de lo que pasó en el equipo.
   */
  async findActivityLogForTeam(
    teamId: string,
    options: { limit?: number; offset?: number; type?: string } = {},
  ) {
    const { limit = 20, offset = 0, type } = options;
    const where = { teamId, ...(type ? { type } : {}) };

    const [items, total] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.activityEvent.count({ where }),
    ]);

    return { items, total };
  }

  // ── Bandeja personal (notificaciones) ───────────────────────────────────────

  async findForUser(userId: string) {
    const rows = await this.prisma.activityEventRecipient.findMany({
      where: { userId },
      include: { event: true },
      orderBy: { event: { createdAt: 'desc' } },
      take: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      type: r.event.type,
      title: r.event.title,
      message: r.event.message,
      read: r.read,
      createdAt: r.event.createdAt,
      data: r.event.data,
    }));
  }

  async countUnread(userId: string) {
    const count = await this.prisma.activityEventRecipient.count({
      where: { userId, read: false },
    });
    return { unread: count };
  }

  async markAsRead(id: number, userId: string) {
    const recipient = await this.prisma.activityEventRecipient.findFirst({
      where: { id, userId },
    });
    if (!recipient) throw new NotFoundException('Notification not found');

    return this.prisma.activityEventRecipient.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.activityEventRecipient.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { message: 'Todas las notificaciones marcadas como leídas' };
  }
}
