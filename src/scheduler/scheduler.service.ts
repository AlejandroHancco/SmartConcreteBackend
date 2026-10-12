import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { MeasurementsService, MeasurementRange } from '../measurements/measurements.service';
import { KronosGateway } from '../gateway/kronos.gateway';
import { MEASUREMENTS_QUEUE } from '../queue/queue.constants';
import {
  MeasurementSchedulingService,
  MeasurementJobData,
  PRIORITY_SCHEDULED,
} from './scheduling.service';

/**
 * Cron que despacha los ScheduledJobs pendientes.
 * Corre cada minuto:
 *  1. Busca jobs 'pending' con startAt <= ahora
 *  2. Salta los que usan un dispositivo (analyzer/mux) ya ocupado por un job 'running'
 *  3. Publica cada job en la cola Bull 'measurements' con prioridad alta
 *     (o fallback directo sin Redis)
 *  4. Marca el job como 'running'
 *  5. Si tiene intervalMinutes y quedan repeticiones, crea el siguiente job
 *     con startAt = ahora + intervalMinutes y repeatCount - 1
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private ticking = false; // evita solapamiento de ticks del cron

  constructor(
    private prisma: PrismaService,
    private measurementsService: MeasurementsService,
    private schedulingService: MeasurementSchedulingService,
    private kronosGateway: KronosGateway,
    @Optional()
    @InjectQueue(MEASUREMENTS_QUEUE)
    private measurementQueue?: Queue<MeasurementJobData>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingJobs() {
    if (this.ticking) return;
    this.ticking = true;

    try {
      const now = new Date();

      // 1. Jobs pendientes cuyo startAt ya venció
      const dueJobs = await this.prisma.scheduledJob.findMany({
        where: { status: 'pending', startAt: { lte: now } },
        orderBy: { startAt: 'asc' },
      });

      if (dueJobs.length === 0) return;

      this.logger.log(`${dueJobs.length} scheduled job(s) due`);

      // 2. Dispositivos ocupados por jobs actualmente en ejecución
      const busyDevices = await this.getBusyDeviceIds();

      for (const job of dueJobs) {
        await this.dispatchJob(job, now, busyDevices);
      }
    } catch (error) {
      this.logger.error(`Scheduler tick failed: ${error.message}`);
    } finally {
      this.ticking = false;
    }
  }

  /** IDs de devices (analyzer + mux) usados por jobs con status 'running' */
  private async getBusyDeviceIds(): Promise<Set<string>> {
    const runningJobs = await this.prisma.scheduledJob.findMany({
      where: { status: 'running' },
      select: { taskId: true },
    });

    const busy = new Set<string>();
    if (runningJobs.length === 0) return busy;

    const preferences = await this.prisma.taskPreference.findMany({
      where: { taskId: { in: runningJobs.map((j) => j.taskId) } },
      select: { analyzerDeviceId: true, muxDeviceId: true },
    });

    for (const pref of preferences) {
      busy.add(pref.analyzerDeviceId);
      busy.add(pref.muxDeviceId);
    }
    return busy;
  }

  private async dispatchJob(
    job: {
      id: number;
      taskId: number;
      createdBy: string;
      label: string | null;
      intervalMinutes: number | null;
      repeatCount: number;
      executionIndex: number;
      channelNumbers: number[];
    },
    now: Date,
    busyDevices: Set<string>,
  ) {
    // Configuración activa de la tarea (devices + rangos de frecuencia)
    const preference = await this.prisma.taskPreference.findFirst({
      where: { taskId: job.taskId },
      orderBy: { createdAt: 'desc' },
      include: { ranges: { orderBy: { order: 'asc' } } },
    });

    if (!preference || preference.ranges.length === 0 || job.channelNumbers.length === 0) {
      this.logger.warn(
        `Job ${job.id} sin preferencia/rangos/canales — marcando como failed`,
      );
      await this.prisma.scheduledJob.update({
        where: { id: job.id },
        data: { status: 'failed' },
      });
      return;
    }

    // 2. Conflicto de dispositivos: otro job corriendo usa el mismo analyzer/mux
    if (busyDevices.has(preference.analyzerDeviceId) || busyDevices.has(preference.muxDeviceId)) {
      this.logger.log(
        `Job ${job.id} pospuesto — dispositivo ocupado por otro job en ejecución`,
      );
      return; // queda 'pending'; se reintenta en el próximo tick
    }

    // 4. Marcar como running (guard de idempotencia: solo si sigue pending)
    const claimed = await this.prisma.scheduledJob.updateMany({
      where: { id: job.id, status: 'pending' },
      data: { status: 'running' },
    });
    if (claimed.count === 0) return; // otro proceso lo tomó

    // Reservar los devices para el resto del tick
    busyDevices.add(preference.analyzerDeviceId);
    busyDevices.add(preference.muxDeviceId);

    const ranges: MeasurementRange[] = preference.ranges.map((r) => ({
      startFreq: Number(r.startFreq),
      stopFreq: Number(r.stopFreq),
      points: r.points,
      sweepType: r.sweepType as 'LOG' | 'LIN',
    }));

    const payload: MeasurementJobData = {
      taskId: job.taskId,
      userId: job.createdBy,
      ranges,
      selectedChannels: job.channelNumbers,
      jobId: `scheduled-${job.id}`,
      estimatedSeconds: this.schedulingService.estimateSeconds(
        ranges,
        job.channelNumbers.length,
      ),
      scheduledJobId: job.id,
      executionIndex: job.executionIndex,
    };

    // 3. Publicar en la cola Bull con prioridad alta (o fallback directo si no hay Redis)
    if (this.measurementQueue) {
      await this.measurementQueue.add('execute', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 100,
        priority: PRIORITY_SCHEDULED, // por delante de las mediciones manuales
      });
      this.logger.log(`Job ${job.id} publicado en la cola (execution ${job.executionIndex})`);
    } else {
      // Sin Redis: ejecución directa fire-and-forget con actualización de status
      this.logger.warn(`Job ${job.id} ejecutándose directamente (sin REDIS_URL)`);
      this.schedulingService.trackFallbackRun(payload.jobId, payload.estimatedSeconds);
      void this.measurementsService
        .measureTask(job.taskId, job.createdBy, payload)
        .then(() =>
          this.prisma.scheduledJob.update({
            where: { id: job.id },
            data: { status: 'completed' },
          }),
        )
        .catch((error) => {
          this.logger.error(`Job ${job.id} falló: ${error.message}`);
          return this.prisma.scheduledJob.update({
            where: { id: job.id },
            data: { status: 'failed' },
          });
        })
        .finally(() => this.schedulingService.untrackFallbackRun(payload.jobId));
    }

    this.kronosGateway.emitJobStatus(job.createdBy, {
      jobId: `scheduled-${job.id}`,
      taskId: job.taskId,
      status: 'processing',
    });

    // 5/6. Programar la siguiente repetición si corresponde
    if (job.intervalMinutes && job.repeatCount > 1) {
      const nextStartAt = new Date(now.getTime() + job.intervalMinutes * 60_000);
      const next = await this.prisma.scheduledJob.create({
        data: {
          taskId: job.taskId,
          createdBy: job.createdBy,
          label: job.label,
          startAt: nextStartAt,
          intervalMinutes: job.intervalMinutes,
          repeatCount: job.repeatCount - 1,       // repeticiones restantes
          executionIndex: job.executionIndex + 1, // posición en la cadena
          channelNumbers: job.channelNumbers,
          status: 'pending',
        },
      });
      this.logger.log(
        `Siguiente ejecución programada: job ${next.id} a las ${nextStartAt.toISOString()} ` +
        `(${next.repeatCount} restante(s))`,
      );
    }
  }
}
