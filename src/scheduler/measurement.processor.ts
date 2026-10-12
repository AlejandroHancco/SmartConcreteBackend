import { Logger } from '@nestjs/common';
import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { MeasurementsService } from '../measurements/measurements.service';
import { KronosGateway } from '../gateway/kronos.gateway';
import { MEASUREMENTS_QUEUE } from '../queue/queue.constants';
import { MeasurementJobData } from './scheduling.service';

/**
 * Procesador de la cola 'measurements'.
 * Concurrencia 1 (default de Bull): el MUX/analyzer solo soporta
 * una medición a la vez — nunca subir la concurrencia de este processor.
 *
 * Reintentos: configurados al publicar el job (attempts: 3, backoff exponencial).
 */
@Processor(MEASUREMENTS_QUEUE)
export class MeasurementProcessor {
  private readonly logger = new Logger(MeasurementProcessor.name);

  constructor(
    private readonly measurementsService: MeasurementsService,
    private readonly kronosGateway: KronosGateway,
    private readonly prisma: PrismaService,
  ) {}

  @Process('execute')
  async handleExecute(job: Job<MeasurementJobData>) {
    const { taskId, userId, ranges, selectedChannels, jobId, scheduledJobId, executionIndex } =
      job.data;

    this.logger.log(
      `Processing measurement job ${job.id} (task ${taskId}, attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    );

    this.kronosGateway.emitJobStatus(userId, {
      jobId: String(job.id),
      taskId,
      status: 'processing',
      attempt: job.attemptsMade + 1,
    });

    // Ejecuta la medición vía TCP (SCPI Hioki + MUX HTTP), guarda en DB
    // y emite measurement:complete a la sala de la tarea (dentro de measureTask).
    const result = await this.measurementsService.measureTask(taskId, userId, {
      ranges,
      selectedChannels,
      jobId,
      scheduledJobId,
      executionIndex,
    });

    // Si vino de un ScheduledJob, marcarlo como completado
    if (scheduledJobId) {
      await this.prisma.scheduledJob.update({
        where: { id: scheduledJobId },
        data: { status: 'completed' },
      });
    }

    this.kronosGateway.emitJobStatus(userId, {
      jobId: String(job.id),
      taskId,
      status: 'completed',
    });

    return result;
  }

  @OnQueueFailed()
  async onFailed(job: Job<MeasurementJobData>, error: Error) {
    const { taskId, userId, scheduledJobId } = job.data;
    const maxAttempts = job.opts.attempts ?? 1;
    const willRetry = job.attemptsMade < maxAttempts;

    this.logger.error(
      `Measurement job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}): ${error.message}`,
    );

    // Fallo definitivo (sin más reintentos) de un ScheduledJob → marcar failed
    if (!willRetry && scheduledJobId) {
      await this.prisma.scheduledJob
        .update({
          where: { id: scheduledJobId },
          data: { status: 'failed' },
        })
        .catch((err) =>
          this.logger.error(`No se pudo marcar scheduled job ${scheduledJobId} como failed: ${err.message}`),
        );
    }

    this.kronosGateway.emitJobStatus(userId, {
      jobId: String(job.id),
      taskId,
      status: willRetry ? 'retrying' : 'failed',
      attempt: job.attemptsMade,
      error: error.message,
    });
  }
}
