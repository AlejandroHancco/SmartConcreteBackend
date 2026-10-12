import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamScopeService } from '../common/team-scope.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { UpdateDeviceStatusDto } from './dto/update-device-status.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { DevicePluginRegistry } from '../device-plugins/device-plugin.registry';

@Injectable()
export class DevicesService {
  constructor(
      private prisma: PrismaService,
      private teamScope: TeamScopeService,
      private devicePlugins: DevicePluginRegistry,
  ) {}

  // ── Global: todos los dispositivos de proyectos del equipo del usuario ──────

  async findAllForUser(userId: string) {
    // Setear contexto RLS de forma parametrizada (sin interpolación directa)
    await this.prisma
        .$executeRaw`SELECT set_config('app.current_user_id', ${userId}, false)`;

    const teamWhere = await this.teamScope.projectWhereForUser(userId);

    return this.prisma.device.findMany({
      where: { project: teamWhere },
      include: {
        project: {
          select: { uuid: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Scoped por proyecto (siempre verificando equipo del caller) ────────────

  async findByProject(projectId: string, userId: string) {
    await this.teamScope.assertProjectInTeam(userId, projectId);
    return this.prisma.device.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneInProject(projectId: string, deviceId: string, userId: string) {
    await this.teamScope.assertProjectInTeam(userId, projectId);
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.projectId !== projectId) {
      throw new NotFoundException('Device not found in this project');
    }

    return device;
  }

  async createInProject(projectId: string, createDeviceDto: CreateDeviceDto, userId: string) {
    await this.teamScope.assertProjectInTeam(userId, projectId);
    return this.prisma.device.create({
      data: {
        ...createDeviceDto,
        projectId,
      },
    });
  }

  async updateInProject(
      projectId: string,
      deviceId: string,
      updateDeviceDto: UpdateDeviceDto,
      userId: string,
  ) {
    await this.findOneInProject(projectId, deviceId, userId);

    return this.prisma.device.update({
      where: { id: deviceId },
      data: updateDeviceDto,
    });
  }

  /** Archivar/desarchivar: los demás estados (online/offline) los controla el health check automático. */
  async updateStatusInProject(
      projectId: string,
      deviceId: string,
      dto: UpdateDeviceStatusDto,
      userId: string,
  ) {
    await this.findOneInProject(projectId, deviceId, userId);

    return this.prisma.device.update({
      where: { id: deviceId },
      data: { status: dto.status },
    });
  }

  async removeFromProject(projectId: string, deviceId: string, userId: string) {
    await this.findOneInProject(projectId, deviceId, userId);

    const usageCount = await this.prisma.taskPreference.count({
      where: {
        OR: [
          { analyzerDeviceId: deviceId },
          { muxDeviceId: deviceId },
        ],
      },
    });

    if (usageCount > 0) {
      throw new HttpException(
          'No se puede eliminar: el dispositivo está en uso en configuraciones de tareas',
          HttpStatus.CONFLICT,
      );
    }

    return this.prisma.device.delete({
      where: { id: deviceId },
    });
  }

  // ── Test de conexión ───────────────────────────────────────────────────────

  async testConnection(dto: TestConnectionDto) {
    const { type, ip } = dto;
    const port = dto.port ?? 3570;

    const reachable = await this.checkReachable(type, ip, port);
    if (reachable) {
      return {
        success: true,
        message: type === 'analyzer' ? `Hioki IM3570 encontrado en ${ip}:${port}` : `MUX encontrado en ${ip}`,
      };
    }
    return {
      success: false,
      message: type === 'analyzer'
        ? `No se pudo conectar al analyzer en ${ip}:${port}`
        : `No se pudo conectar al MUX en ${ip}`,
    };
  }

  /**
   * Chequeo crudo de alcanzabilidad (sin mensajes), usado también por el health check
   * periódico. Delega en el plugin registrado para `type` — un dispositivo nuevo
   * (type distinto) queda cubierto automáticamente con solo registrar su plugin.
   */
  async checkReachable(type: string, ip: string, port = 3570): Promise<boolean> {
    if (!this.devicePlugins.has(type)) return false;
    return this.devicePlugins.get(type).testConnection(ip, type, port);
  }
}