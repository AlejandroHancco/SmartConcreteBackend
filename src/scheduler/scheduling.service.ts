import { ConflictException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { MeasurementsService, MeasurementRange } from '../measurements/measurements.service';
import { KronosGateway } from '../gateway/kronos.gateway';
import { MEASUREMENTS_QUEUE } from '../queue/queue.constants';

/** Payload de los jobs de la cola 'measurements' */
export interface MeasurementJobData {
  taskId: number;
  userId: string;
  ranges: MeasurementRange[];
  selectedChannels: number[];
  jobId: string;
  /** Duración estimada (segundos) — usada para calcular el backlog de la cola */
  estimatedSeconds: number;
  /** Presentes solo cuando la medición proviene de un ScheduledJob */
  scheduledJobId?: number;
  executionIndex?: number;
}

export interface AvailabilityResult {
  available: boolean;
  reason?: 'queue_full' | 'scheduled_conflict' | 'no_preference';
  message?: string;
  /** Duración estimada de ESTA medición (s) */
  estimatedSeconds: number;
  /** Trabajo ya encolado por delante (s) */
  backlogSeconds: number;
  /** Capacidad máxima de backlog aceptada (s) */
  maxBacklogSeconds: number;
  /** Próximo job programado que chocaría (si aplica) */
  nextScheduledAt?: Date;
}

// ── Modelo ADITIVO de duración ────────────────────────────────────────────────
// total = canales × [ T_MUX + Σ_rangos (T_SETUP + puntos × T_PUNTO) ]
// Cada canal repite todos los rangos (así mide measureTask), por eso es aditivo:
// más canales o más rangos ⇒ más tiempo, linealmente.
const MUX_SWITCH_SECONDS = 1.5; // cambio de canal en el MUX (HTTP + asentamiento)
const RANGE_SETUP_SECONDS = 1;  // comandos SCPI de setup por rango (6 × 100ms + margen)
const SECONDS_PER_POINT = 0.01; // barrido: ~8s para 801 puntos

// Prioridades Bull (menor = más prioritario): los jobs programados van primero
export const PRIORITY_SCHEDULED = 1;
export const PRIORITY_MANUAL = 10;

/**
 * Control de admisión de mediciones manuales.
 * - Si el equipo está libre, la medición entra y corre de inmediato.
 * - Si hay cola, entra detrás de lo pendiente (concurrencia 1 por hardware).
 * - Se RECHAZA cuando el backlog superaría el máximo, o cuando terminaría
 *   pisando el startAt de una medición programada en los mismos dispositivos.
 */
@Injectable()
export class MeasurementSchedulingService {
  private readonly logger = new Logger(MeasurementSchedulingService.name);
  private readonly maxBacklogSeconds =
    Number(process.env.SCHEDULER_MAX_BACKLOG_SECONDS) || 15 * 60;
  private readonly scheduledMarginSeconds = 60;

  /** Backlog en memoria para el modo fallback (sin Redis) */
  private fallbackRuns = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private measurementsService: MeasurementsService,
    private kronosGateway: KronosGateway,
    @Optional()
    @InjectQueue(MEASUREMENTS_QUEUE)
    private measurementQueue?: Queue<MeasurementJobData>,
  ) {}

  /** Estimación aditiva: canales × (mux + Σ rangos(setup + puntos·t)) */
  estimateSeconds(
    ranges: { points: number }[],
    channelCount: number,
  ): number {
    const perChannel =
      MUX_SWITCH_SECONDS +
      ranges.reduce(
        (sum, r) => sum + RANGE_SETUP_SECONDS + r.points * SECONDS_PER_POINT,
        0,
      );
    return Math.ceil(channelCount * perChannel);
  }

  /** Segundos de trabajo pendiente/activo en la cola (o en memoria sin Redis) */
  async getBacklogSeconds(): Promise<number> {
    if (this.measurementQueue) {
      try {
        const jobs = await this.measurementQueue.getJobs(['waiting', 'active', 'delayed']);
        return jobs.reduce((sum, j) => sum + (j.data?.estimatedSeconds ?? 60), 0);
      } catch (err) {
        this.logger.warn(`No se pudo leer la cola (${err.message}) — backlog 0`);
        return 0;
      }
    }
    let total = 0;
    for (const est of this.fallbackRuns.values()) total += est;
    return total;
  }

  /**
   * ¿Se puede aceptar esta medición ahora?
   * 1. Backlog + estimación no debe superar el máximo.
   * 2. No debe terminar chocando con un ScheduledJob pendiente
   *    que use los mismos dispositivos (analyzer/mux) dentro del horizonte.
   */
  async checkAvailability(
    taskId: number,
    ranges: { points: number }[],
    selectedChannels: number[],
  ): Promise<AvailabilityResult> {
    const estimatedSeconds = this.estimateSeconds(ranges, selectedChannels.length);
    const backlogSeconds = await this.getBacklogSeconds();

    const base = {
      estimatedSeconds,
      backlogSeconds,
      maxBacklogSeconds: this.maxBacklogSeconds,
    };

    // Regla 0: la tarea necesita un analyzer y un MUX asignados (TaskPreference)
    // antes de poder medir — se valida aquí para que el 400 llegue de inmediato
    // en la respuesta HTTP, no minutos después cuando el worker ya lo intentó.
    const hasPreference = await this.prisma.taskPreference.findFirst({
      where: { taskId },
      select: { id: true },
    });
    if (!hasPreference) {
      return {
        ...base,
        available: false,
        reason: 'no_preference',
        message: 'Esta tarea no tiene un analizador y un MUX asignados. Configúralos antes de medir.',
      };
    }

    // Regla 1: cola llena
    if (backlogSeconds + estimatedSeconds > this.maxBacklogSeconds) {
      return {
        ...base,
        available: false,
        reason: 'queue_full',
        message:
          `La cola está llena: hay ~${Math.ceil(backlogSeconds / 60)} min de mediciones pendientes ` +
          `y esta medición añadiría ~${Math.ceil(estimatedSeconds / 60)} min más ` +
          `(máximo ${Math.ceil(this.maxBacklogSeconds / 60)} min). Intenta más tarde o reduce rangos/canales.`,
      };
    }

    // Regla 2: choque con mediciones programadas en los mismos dispositivos
    const horizonSeconds = backlogSeconds + estimatedSeconds + this.scheduledMarginSeconds;
    const conflict = await this.findScheduledConflict(taskId, horizonSeconds);
    if (conflict) {
      return {
        ...base,
        available: false,
        reason: 'scheduled_conflict',
        nextScheduledAt: conflict.startAt,
        message:
          `Esta medición (~${Math.ceil(estimatedSeconds / 60)} min, tras ~${Math.ceil(backlogSeconds / 60)} min de cola) ` +
          `chocaría con una medición programada para las ${conflict.startAt.toISOString()} ` +
          `que usa los mismos dispositivos. Intenta después de que se ejecute.`,
      };
    }

    return { ...base, available: true };
  }

  /**
   * Punto de entrada del clic en "medir": valida admisión y encola (o ejecuta
   * directo sin Redis). Lanza 409 Conflict si no se puede aceptar.
   */
  async requestMeasurement(
    taskId: number,
    userId: string,
    params: {
      ranges: MeasurementRange[];
      selectedChannels: number[];
      jobId?: string;
    },
  ) {
    const check = await this.checkAvailability(taskId, params.ranges, params.selectedChannels);
    if (!check.available) {
      throw new ConflictException({
        statusCode: 409,
        error: check.reason,
        message: check.message,
        estimatedSeconds: check.estimatedSeconds,
        backlogSeconds: check.backlogSeconds,
        maxBacklogSeconds: check.maxBacklogSeconds,
        nextScheduledAt: check.nextScheduledAt ?? null,
      });
    }

    const jobId = params.jobId || `${taskId}-${Date.now()}`;
    const payload: MeasurementJobData = {
      taskId,
      userId,
      ranges: params.ranges,
      selectedChannels: params.selectedChannels,
      jobId,
      estimatedSeconds: check.estimatedSeconds,
    };

    if (this.measurementQueue) {
      const job = await this.measurementQueue.add('execute', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 100,
        priority: PRIORITY_MANUAL, // los ScheduledJobs (priority 1) pasan primero
      });

      this.kronosGateway.emitJobStatus(userId, {
        jobId: String(job.id),
        taskId,
        status: 'queued',
      });

      return {
        jobId: String(job.id),
        status: 'queued' as const,
        estimatedSeconds: check.estimatedSeconds,
        estimatedWaitSeconds: check.backlogSeconds,
      };
    }

    // Fallback sin Redis: ejecución directa, registrando el backlog en memoria
    this.logger.warn('REDIS_URL no configurado — ejecutando medición de forma síncrona');
    this.fallbackRuns.set(jobId, check.estimatedSeconds);
    try {
      return await this.measurementsService.measureTask(taskId, userId, { ...params, jobId });
    } finally {
      this.fallbackRuns.delete(jobId);
    }
  }

  /** Registra una ejecución directa externa (usada por el cron en modo fallback) */
  trackFallbackRun(jobId: string, estimatedSeconds: number): void {
    this.fallbackRuns.set(jobId, estimatedSeconds);
  }

  untrackFallbackRun(jobId: string): void {
    this.fallbackRuns.delete(jobId);
  }

  /**
   * Busca un ScheduledJob 'pending' cuyo startAt caiga dentro del horizonte
   * y cuya tarea comparta analyzer/mux con la tarea dada.
   */
  private async findScheduledConflict(
    taskId: number,
    horizonSeconds: number,
  ): Promise<{ id: number; startAt: Date } | null> {
    // Dispositivos de la tarea que quiere medir
    const myPreference = await this.prisma.taskPreference.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      select: { analyzerDeviceId: true, muxDeviceId: true },
    });
    if (!myPreference) return null; // sin preferencia: measureTask fallará con su propio error

    const horizonEnd = new Date(Date.now() + horizonSeconds * 1000);

    const pendingJobs = await this.prisma.scheduledJob.findMany({
      where: { status: 'pending', startAt: { lte: horizonEnd } },
      orderBy: { startAt: 'asc' },
      select: { id: true, taskId: true, startAt: true },
    });
    if (pendingJobs.length === 0) return null;

    // Preferencias (devices) de las tareas de esos jobs, en bloque
    const preferences = await this.prisma.taskPreference.findMany({
      where: { taskId: { in: [...new Set(pendingJobs.map((j) => j.taskId))] } },
      orderBy: { createdAt: 'desc' },
      select: { taskId: true, analyzerDeviceId: true, muxDeviceId: true },
    });
    // findMany devuelve todas; nos quedamos con la más reciente por tarea
    const prefByTask = new Map<number, { analyzerDeviceId: string; muxDeviceId: string }>();
    for (const p of preferences) {
      if (!prefByTask.has(p.taskId)) prefByTask.set(p.taskId, p);
    }

    for (const job of pendingJobs) {
      const pref = prefByTask.get(job.taskId);
      if (!pref) continue;
      const sharesDevice =
        pref.analyzerDeviceId === myPreference.analyzerDeviceId ||
        pref.muxDeviceId === myPreference.muxDeviceId;
      if (sharesDevice) {
        return { id: job.id, startAt: job.startAt };
      }
    }
    return null;
  }
}
