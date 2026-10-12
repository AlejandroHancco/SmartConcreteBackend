import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from './devices.service';
import { KronosGateway } from '../gateway/kronos.gateway';

const CHECK_INTERVAL_MS = 30_000;
const CONCURRENCY = 5;

/**
 * Chequea periódicamente si cada dispositivo (analyzer/mux) está online, sin saturar
 * la red local ni el proceso: corre cada 30s, con un máximo de 5 chequeos en paralelo,
 * y solo escribe en DB / emite por WebSocket cuando el estado realmente cambia.
 */
@Injectable()
export class DeviceHealthService {
  private readonly logger = new Logger(DeviceHealthService.name);
  private ticking = false;

  constructor(
    private prisma: PrismaService,
    private devicesService: DevicesService,
    private kronosGateway: KronosGateway,
  ) {}

  @Interval(CHECK_INTERVAL_MS)
  async checkAllDevices() {
    if (this.ticking) return;
    this.ticking = true;

    try {
      const devices = await this.prisma.device.findMany({
        where: { ip: { not: null }, status: { not: 'archived' } },
        select: { id: true, ip: true, type: true, status: true, projectId: true },
      });

      for (let i = 0; i < devices.length; i += CONCURRENCY) {
        const batch = devices.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((device) => this.checkOne(device)));
      }
    } catch (err: any) {
      this.logger.warn(`Device health check failed: ${err.message}`);
    } finally {
      this.ticking = false;
    }
  }

  private async checkOne(device: {
    id: string;
    ip: string | null;
    type: string | null;
    status: string;
    projectId: string;
  }) {
    if (!device.ip) return;

    const reachable = await this.devicesService.checkReachable(device.type ?? 'analyzer', device.ip);
    const newStatus = reachable ? 'online' : 'offline';

    if (newStatus === device.status) return;

    await this.prisma.device.update({
      where: { id: device.id },
      data: { status: newStatus },
    });

    this.kronosGateway.emitDeviceStatusChanged(device.id, device.projectId, newStatus);
  }
}
