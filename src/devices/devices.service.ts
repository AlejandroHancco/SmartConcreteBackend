import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import * as net from 'net';
import axios from 'axios';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  // ── Global: todos los dispositivos de proyectos donde el usuario tiene rol ──

  async findAllForUser(userId: string) {
    // Setear contexto RLS antes de la query para que Supabase
    // permita leer user_project_roles del schema platform
    await this.prisma.$executeRawUnsafe(
        `SET app.current_user_id = '${userId}'`,
    );

    return this.prisma.device.findMany({
      where: {
        project: {
          userProjectRoles: {
            some: { userId },
          },
        },
      },
      include: {
        project: {
          select: { uuid: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Scoped por proyecto ────────────────────────────────────────────────────

  async findByProject(projectId: string) {
    return this.prisma.device.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneInProject(projectId: string, deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.projectId !== projectId) {
      throw new NotFoundException('Device not found in this project');
    }

    return device;
  }

  async createInProject(projectId: string, createDeviceDto: CreateDeviceDto) {
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
  ) {
    await this.findOneInProject(projectId, deviceId);

    return this.prisma.device.update({
      where: { id: deviceId },
      data: updateDeviceDto,
    });
  }

  async removeFromProject(projectId: string, deviceId: string) {
    await this.findOneInProject(projectId, deviceId);

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

    if (type === 'analyzer') {
      const port = dto.port ?? 3570;
      return new Promise<{ success: boolean; message: string }>((resolve) => {
        const socket = net.createConnection({ host: ip, port });
        socket.setTimeout(2000);

        socket.on('connect', () => {
          socket.destroy();
          resolve({ success: true, message: `Hioki IM3570 encontrado en ${ip}:${port}` });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({ success: false, message: `Timeout connecting to analyzer at ${ip}:${port}` });
        });

        socket.on('error', (err) => {
          socket.destroy();
          resolve({ success: false, message: `Error connecting to analyzer: ${err.message}` });
        });
      });
    } else {
      try {
        await axios.get(`http://${ip}`, { timeout: 2000 });
        return { success: true, message: `MUX encontrado en ${ip}` };
      } catch (err: any) {
        return { success: false, message: `Error connecting to MUX at ${ip}: ${err.message}` };
      }
    }
  }
}