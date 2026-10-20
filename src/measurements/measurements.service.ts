import { Injectable, HttpException, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamScopeService } from '../common/team-scope.service';
import { MeasurementsGateway } from './measurements.gateway';
import { KronosGateway } from '../gateway/kronos.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { classifyMeasurement, MeasurementClassification } from './kronos-watcher';
import { DevicePluginRegistry } from '../device-plugins/device-plugin.registry';
import { CreateMeasurementDto } from './dto/create-measurement.dto';

export interface MeasurementRange {
  startFreq: number;
  stopFreq: number;
  points: number;
  sweepType: 'LOG' | 'LIN';
}

@Injectable()
export class MeasurementsService {
  private readonly logger = new Logger(MeasurementsService.name);

  constructor(
      private prisma: PrismaService,
      private teamScope: TeamScopeService,
      private measurementsGateway: MeasurementsGateway,
      private kronosGateway: KronosGateway,
      private notificationsService: NotificationsService,
      private devicePlugins: DevicePluginRegistry,
  ) {}

  /** Notifica al equipo del resultado de una medición (según clasificación del Kronos Watcher), sin romper el flujo si falla. */
  private async notifyTeamOfMeasurementOutcome(
      userId: string,
      taskId: number,
      deviceNames: string[],
      outcome: MeasurementClassification,
  ): Promise<void> {
    try {
      const teamId = await this.teamScope.getTeamId(userId);
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { project: { select: { name: true } } },
      });
      const projectName = task?.project?.name ?? `Proyecto de la tarea ${taskId}`;

      if (outcome.severity === 'correct') {
        await this.notificationsService.notifyTeamMeasurementSuccess(teamId, projectName, deviceNames);
      } else if (outcome.severity === 'warning') {
        await this.notificationsService.notifyTeamMeasurementWarning(teamId, projectName, deviceNames, outcome.reason!);
      } else {
        await this.notificationsService.notifyTeamMeasurementFailed(teamId, projectName, deviceNames, outcome.reason!, outcome.bare);
      }
    } catch (notifyError) {
      this.logger.warn(`No se pudo notificar al equipo del resultado de la medición: ${notifyError.message}`);
    }
  }

  async getLatest(userId: string) {
    const teamWhere = await this.teamScope.projectWhereForUser(userId);

    return this.prisma.measurement.findFirst({
      where: { task: { project: teamWhere } },
      orderBy: { takenAt: 'desc' },
      include: {
        task: {
          select: {
            id: true,
            name: true,
            project: { select: { uuid: true, name: true } },
          },
        },
        measurementChannels: {
          select: { channelNumber: true, channelAlias: true },
        },
      },
    });
  }

  async create(createMeasurementDto: CreateMeasurementDto, userId: string) {
    await this.teamScope.assertTaskInTeam(userId, createMeasurementDto.taskId);
    return this.prisma.measurement.create({
      data: createMeasurementDto,
    });
  }

  async findAll(userId: string) {
    const teamWhere = await this.teamScope.projectWhereForUser(userId);
    return this.prisma.measurement.findMany({
      where: { task: { project: teamWhere } },
      orderBy: { takenAt: 'desc' },
    });
  }

  async findByTask(taskId: number, userId: string) {
    await this.teamScope.assertTaskInTeam(userId, taskId);
    return this.prisma.measurement.findMany({
      where: { taskId },
      orderBy: { takenAt: 'desc' },
    });
  }

  async findOne(id: number, userId: string) {
    await this.teamScope.assertMeasurementInTeam(userId, id);
    const measurement = await this.prisma.measurement.findUnique({
      where: { id },
    });

    if (!measurement) {
      return null;
    }

    return {
      ...measurement,
      startFreq: Number(measurement.startFreq),
      stopFreq:  Number(measurement.stopFreq),
    };
  }

  async remove(id: number, userId: string) {
    await this.teamScope.assertMeasurementInTeam(userId, id);
    return this.prisma.measurement.delete({
      where: { id },
    });
  }

  /**
   * Actualizar metadata del canal en una medicion
   * PATCH /measurements/:id/channels/:channelNumber
   */
  async updateMeasurementChannelMetadata(
      measurementId: number,
      channelNumber: number,
      userId: string,
      updateData: {
        concreteMix?: number;
        hasEmulsifier?: boolean;
        notes?: string;
        sampleAge?: number;
        temperature?: number;
        humidity?: number;
      },
  ) {
    await this.teamScope.assertMeasurementInTeam(userId, measurementId);
    const measurementChannel = await this.prisma.measurementChannel.findUnique({
      where: {
        measurementId_channelNumber: { measurementId, channelNumber },
      },
    });

    if (!measurementChannel) {
      throw new HttpException(
          `MeasurementChannel not found: measurement ${measurementId}, channel ${channelNumber}`,
          HttpStatus.NOT_FOUND,
      );
    }

    return this.prisma.measurementChannel.update({
      where: { id: measurementChannel.id },
      data: updateData,
    });
  }

  /**
   * Medir tarea completa con canales seleccionados
   * Llamado desde tasks.service con jobId para tracking WebSocket
   */
  async measureTask(
      taskId: number,
      userId: string,
      params: {
        ranges: MeasurementRange[];
        selectedChannels: number[];
        jobId?: string;
        scheduledJobId?: number;
        executionIndex?: number;
      },
  ) {
    const jobId = params.jobId || `${taskId}-${Date.now()}`;
    let deviceNames: string[] = [];

    try {
      this.logger.log(`Starting measurement - Task: ${taskId}, JobId: ${jobId}, Ranges: ${params.ranges.length}`);

      if (!params.selectedChannels || params.selectedChannels.length === 0) {
        throw new HttpException(
            'No channels selected for this task',
            HttpStatus.BAD_REQUEST,
        );
      }

      if (!params.ranges || params.ranges.length === 0) {
        throw new HttpException(
            'No frequency ranges specified',
            HttpStatus.BAD_REQUEST,
        );
      }

      const uniqueChannels = Array.from(new Set(params.selectedChannels)).sort(
          (a, b) => a - b,
      );

      // 1. Obtener task_preference activa
      const taskPreference = await this.prisma.taskPreference.findFirst({
        where: { taskId },
        orderBy: { createdAt: 'desc' },
        include: {
          analyzerDevice: true,
          muxDevice: true,
        },
      });

      if (!taskPreference) {
        throw new BadRequestException(
            'Esta tarea no tiene un analizador y un MUX asignados. Configúralos antes de medir.',
        );
      }

      deviceNames = [taskPreference.analyzerDevice.name, taskPreference.muxDevice.name].filter(Boolean);

      // Resuelve el plugin según el tipo del analyzer (device.type) — el Kronos Watcher
      // no sabe (ni necesita saber) que hoy es un Hioki IM3570.
      const plugin = this.devicePlugins.get(taskPreference.analyzerDevice.type);

      this.logger.log(
          `Preference found - Analyzer: ${taskPreference.analyzerDevice.ip}:3570, MUX: ${taskPreference.muxDevice.ip}`,
      );

      this.logger.log(
          `Measuring ${uniqueChannels.length} channels × ${params.ranges.length} ranges sequentially`,
      );

      // 2. Obtener aliases configurados para los canales de esta tarea
      const taskChannels = await this.prisma.taskChannel.findMany({
        where: { taskId, channelNumber: { in: uniqueChannels } },
      });

      const aliasMap = new Map(
          taskChannels.map((tc) => [tc.channelNumber, tc.alias]),
      );

      // 3. Inicializar datos
      const allData = new Map<number, { g: number[]; b: number[] }>();

      // 4. Medir cada canal de forma SECUENCIAL.
      //    El MUX solo puede tener un canal activo a la vez —
      //    Promise.all corrupta los datos porque cambia el canal
      //    antes de que el analyzer termine de medir el anterior.
      //    Por cada canal se recorren todos los rangos secuencialmente
      //    sin cambiar el MUX entre rangos.
      const results: { channel: number; channelData: Array<[number, number, number]> | null }[] = [];

      for (let index = 0; index < uniqueChannels.length; index++) {
        const channel = uniqueChannels[index];

        try {
          // 4a. Cambiar canal en MUX una sola vez por canal
          await plugin.selectChannel(taskPreference.muxDevice.ip ?? '', channel);

          // 4b. Medir todos los rangos para este canal
          const channelData: Array<[number, number, number]> = [];
          for (const range of params.ranges) {
            const rangeData = await plugin.measureChannel({
              analyzerIp: taskPreference.analyzerDevice.ip ?? '',
              startFreq: range.startFreq,
              stopFreq: range.stopFreq,
              points: range.points,
              sweepType: range.sweepType,
            });
            channelData.push(
                ...rangeData.map(
                    (p): [number, number, number] => [p.frequency, p.values.g ?? 0, p.values.b ?? 0],
                ),
            );
          }

          this.logger.log(
              `Channel ${channel} measured - ${channelData.length} points across ${params.ranges.length} ranges`,
          );

          results.push({ channel, channelData });

          // 4c. Emitir progreso DESPUÉS de medir para reflejar estado real
          const progress = Math.round(((index + 1) / uniqueChannels.length) * 100);
          this.measurementsGateway.emitMeasurementProgress(
              userId,
              jobId,
              channel,
              uniqueChannels.length,
              progress,
              `Canal ${channel} completado (${index + 1} de ${uniqueChannels.length})`,
          );

        } catch (channelError) {
          this.logger.error(
              `Error in channel ${channel}: ${channelError.message}`,
          );
          results.push({ channel, channelData: null });

          const progress = Math.round(((index + 1) / uniqueChannels.length) * 100);
          this.measurementsGateway.emitMeasurementProgress(
              userId,
              jobId,
              channel,
              uniqueChannels.length,
              progress,
              `Canal ${channel} falló — continuando...`,
          );
        }
      }

      // 5. Procesar resultados
      for (const { channel, channelData } of results) {
        if (!channelData) continue;

        for (const [freq, gValue, bValue] of channelData) {
          if (!allData.has(freq)) {
            allData.set(freq, {
              g: Array(16).fill(0),
              b: Array(16).fill(0),
            });
          }
          const data = allData.get(freq)!;
          data.g[channel - 1] = gValue;
          data.b[channel - 1] = bValue;
        }
      }

      // 6. Construir array JSONB final ordenado por frecuencia
      const measurementData = Array.from(allData.entries())
          .sort(([freqA], [freqB]) => freqA - freqB)
          .map(([frequency, vals]) => ({
            frequency,
            g: vals.g,
            b: vals.b,
          }));

      this.logger.log(`Total points collected: ${measurementData.length}`);

      const firstRange = params.ranges[0];
      const lastRange = params.ranges[params.ranges.length - 1];
      const totalPoints = params.ranges.reduce((sum, r) => sum + r.points, 0);

      // 7. Guardar medición en DB
      const measurement = await this.prisma.measurement.create({
        data: {
          taskId,
          takenBy: userId,
          scheduledJobId: params.scheduledJobId ?? null,
          executionIndex: params.executionIndex ?? null,
          presetName: taskPreference.name,
          startFreq: firstRange.startFreq,
          stopFreq: lastRange.stopFreq,
          points: totalPoints,
          sweepType: firstRange.sweepType,
          analyzerName: taskPreference.analyzerDevice.name,
          analyzerIp: taskPreference.analyzerDevice.ip ?? '',
          muxName: taskPreference.muxDevice.name,
          muxIp: taskPreference.muxDevice.ip ?? '',
          data: measurementData,
        } as any,
      });

      this.logger.log(`Measurement saved - ID: ${measurement.id}`);

      // 8. Crear MeasurementChannels usando el alias real si existe
      for (const channelNumber of uniqueChannels) {
        await this.prisma.measurementChannel.create({
          data: {
            measurementId: measurement.id,
            channelNumber,
            channelAlias: aliasMap.get(channelNumber) ?? `Canal ${channelNumber}`,
          },
        });
      }

      this.logger.log(
          `MeasurementChannels created for measurement ${measurement.id}`,
      );

      // 9. Emitir completado (sala personal del usuario + sala de la tarea)
      this.measurementsGateway.emitMeasurementCompleted(
          userId,
          jobId,
          measurement.id,
          measurement.takenAt || new Date(),
          measurementData.length,
          measurementData,
      );

      this.kronosGateway.emitMeasurementComplete(taskId, {
        jobId,
        measurementId: measurement.id,
        takenAt: measurement.takenAt || new Date(),
        totalPoints: measurementData.length,
      });

      const classification = classifyMeasurement(measurementData, uniqueChannels);
      await this.notifyTeamOfMeasurementOutcome(userId, taskId, deviceNames, classification);

      return {
        measurementId: measurement.id,
        takenAt: measurement.takenAt || new Date(),
        totalPoints: measurementData.length,
        data: measurementData,
      };

    } catch (error) {
      this.logger.error(`Measurement error: ${error.message}`);

      this.measurementsGateway.emitMeasurementError(
          userId,
          jobId,
          error.message,
      );

      await this.notifyTeamOfMeasurementOutcome(userId, taskId, deviceNames, {
        severity: 'error',
        reason: error.message,
      });

      throw error;
    }
  }

}