import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MeasurementsGateway } from './measurements.gateway';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { UpdateMeasurementDto } from './dto/update-measurement.dto';
import * as net from 'net';
import axios from 'axios';

@Injectable()
export class MeasurementsService {
  private readonly logger = new Logger(MeasurementsService.name);

  constructor(
      private prisma: PrismaService,
      private measurementsGateway: MeasurementsGateway,
  ) {}

  async create(createMeasurementDto: CreateMeasurementDto) {
    return this.prisma.measurement.create({
      data: createMeasurementDto,
    });
  }

  async findAll() {
    return this.prisma.measurement.findMany();
  }

  async findByTask(taskId: number) {
    return this.prisma.measurement.findMany({
      where: { taskId },
      orderBy: { takenAt: 'desc' },
    });
  }

  async findOne(id: number) {
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

  async update(id: number, updateMeasurementDto: UpdateMeasurementDto) {
    return this.prisma.measurement.update({
      where: { id },
      data: updateMeasurementDto,
    });
  }

  async remove(id: number) {
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
      updateData: {
        concreteMix?: number;
        hasEmulsifier?: boolean;
        notes?: string;
        sampleAge?: number;
        temperature?: number;
        humidity?: number;
      },
  ) {
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
        startFreq: number;
        stopFreq: number;
        points: number;
        sweepType: 'LOG' | 'LIN';
          selectedChannels: number[];
          jobId?: string;
          rangeId?: number;
      },
  ) {
    const jobId = params.jobId || `${taskId}-${Date.now()}`;

    try {
      this.logger.log(`Starting measurement - Task: ${taskId}, JobId: ${jobId}`);

      // Validar canales seleccionados
      if (!params.selectedChannels || params.selectedChannels.length === 0) {
        throw new HttpException(
            'No channels selected for this task',
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
        throw new HttpException(
            'No active task preference found',
            HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(
          `Preference found - Analyzer: ${taskPreference.analyzerDevice.ip}:3570, MUX: ${taskPreference.muxDevice.ip}`,
      );

      this.logger.log(
          `Measuring ${uniqueChannels.length} channels sequentially: ${uniqueChannels.join(', ')}`,
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

      // 4. FIX: Medir cada canal de forma SECUENCIAL
      //    El MUX solo puede tener un canal activo a la vez —
      //    Promise.all corrupta los datos porque cambia el canal
      //    antes de que el analyzer termine de medir el anterior.
      const results: { channel: number; channelData: Array<[number, number, number]> | null }[] = [];

      for (let index = 0; index < uniqueChannels.length; index++) {
        const channel = uniqueChannels[index];

        try {
          // 4a. Cambiar canal en MUX y esperar confirmación
          await this.activateMuxChannel(
              taskPreference.muxDevice.ip ?? '',
              channel,
              3,
          );

          // 4b. Recién ahora medir — el MUX ya está estable en el canal correcto
          const channelData = await this.measureChannel(
              taskPreference.analyzerDevice.ip ?? '',
              params.startFreq,
              params.stopFreq,
              params.points,
              params.sweepType,
          );

          this.logger.log(
              `Channel ${channel} measured - ${channelData.length} points`,
          );

          results.push({ channel, channelData });

          // 4c. Emitir progreso DESPUÉS de medir (no antes) para reflejar estado real
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

          // Emitir progreso aunque falle para que el frontend no se quede colgado
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

      // 7. Guardar medición en DB
      const measurement = await this.prisma.measurement.create({
        data: {
          taskId,
          takenBy: userId,                    // raw FK — fine in UncheckedCreateInput
          presetName: taskPreference.name,
          startFreq: params.startFreq,
          stopFreq: params.stopFreq,
          points: params.points,
          sweepType: params.sweepType,
          rangeId: params.rangeId ?? null,
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

      // 9. Emitir completado
      this.measurementsGateway.emitMeasurementCompleted(
          userId,
          jobId,
          measurement.id,
          measurement.takenAt || new Date(),
          measurementData.length,
          measurementData,
      );

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

      throw error;
    }
  }

  /**
   * Activar canal en MUX (con reintentos)
   */
  private async activateMuxChannel(
      muxIp: string,
      channel: number,
      retries: number = 3,
  ): Promise<void> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await axios.get(`http://${muxIp}/?orden=${channel}`, {
          timeout: 5000,
          validateStatus: () => true,
        });
        return; // Éxito
      } catch (error) {
        if (attempt === retries - 1) {
          throw new Error(
              `Could not activate MUX channel ${channel}: ${error.message}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  /**
   * Medir un canal del Hioki IM3570
   * Lee byte a byte según protocolo SCPI del Hioki
   * Retorna Promise<Array<[frequency, g, b]>>
   */
  private measureChannel(
      analyzerIp: string,
      startFreq: number,
      stopFreq: number,
      points: number,
      sweepType: string,
  ): Promise<Array<[number, number, number]>> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: analyzerIp, port: 3570 }, () => {
        socket.setTimeout(60000);

        const setupCommands = [
          ':MODE ANALyzer',
          ':SWEep:TRIGger SEQuential',
          `:LIST:STARt:STOP ${startFreq},${stopFreq},${points},${sweepType}`,
          ':PARameter1 G',
          ':PARameter3 B',
          '*TRG',
        ];

        (async () => {
          try {
            // 1. Enviar comandos de setup sin esperar respuesta
            for (const cmd of setupCommands) {
              socket.write(cmd + '\r\n');
              await new Promise((r) => setTimeout(r, 100));
            }

            // 2. Enviar :MEASure? y leer respuesta byte a byte
            socket.write(':MEASure?\r\n');

            const csvRaw = await new Promise<string>((res, rej) => {
              let response = '';
              let timeoutHandle: NodeJS.Timeout;

              const onData = (chunk: Buffer) => {
                for (const byte of chunk) {
                  const char = String.fromCharCode(byte);

                  // Leer hasta encontrar \n (ignorar \r)
                  if (char === '\n') {
                    clearTimeout(timeoutHandle);
                    socket.removeListener('data', onData);
                    res(response);
                    return;
                  }

                  if (char !== '\r') {
                    response += char;
                  }
                }
              };

              socket.on('data', onData);

              // Timeout de 55 segundos para esperar datos
              timeoutHandle = setTimeout(() => {
                socket.removeListener('data', onData);
                rej(new Error('Timeout waiting for measurement data'));
              }, 55000);
            });

            // 3. Loguear primeros y últimos 100 chars del CSV recibido
            const csvPreview =
                csvRaw.length <= 100
                    ? csvRaw
                    : `${csvRaw.substring(0, 100)} ... ${csvRaw.substring(csvRaw.length - 100)}`;
            this.logger.debug(`CSV Response (${csvRaw.length} chars): ${csvPreview}`);

            // 4. Parsear CSV como triplas [freq, g, b]
            const csvData = csvRaw.split(',');
            const data: Array<[number, number, number]> = [];

            for (let i = 0; i + 2 < csvData.length; i += 3) {
              const freq = parseFloat(csvData[i]);
              const g = parseFloat(csvData[i + 1]);
              const b = parseFloat(csvData[i + 2]);

              if (!isNaN(freq) && !isNaN(g) && !isNaN(b)) {
                data.push([freq, g, b]);
              }
            }

            socket.destroy();
            resolve(data);

          } catch (err) {
            socket.destroy();
            reject(err);
          }
        })();
      });

      socket.on('error', reject);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Analyzer connection timeout'));
      });
    });
  }
}