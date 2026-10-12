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
      type: 'TEAM_REQUEST',
    });
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
