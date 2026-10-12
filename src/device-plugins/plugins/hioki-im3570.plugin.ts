import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
import axios from 'axios';
import {
  DeviceDriverPlugin,
  DeviceServiceDescription,
  MeasureChannelParams,
  MeasuredPoint,
} from '../device-plugin.interface';

/**
 * Plugin del analyzer Hioki IM3570 (sensor, protocolo SCPI sobre TCP) + su MUX de
 * switching (actuator, protocolo HTTP). Es el primer "component module" del Kronos
 * Watcher, implementado según el estándar IEEE 1876 (LaaS).
 */
@Injectable()
export class HiokiIm3570Plugin implements DeviceDriverPlugin {
  private readonly logger = new Logger(HiokiIm3570Plugin.name);

  static readonly DEVICE_TYPE = 'analyzer';
  static readonly MUX_DEVICE_TYPE = 'mux';

  describe(): DeviceServiceDescription {
    return {
      deviceType: HiokiIm3570Plugin.DEVICE_TYPE,
      manufacturer: 'Hioki',
      description: 'Hioki IM3570 LCR Meter (vía MUX de switching de canales)',
      sensors: [
        {
          sensorId: 'hioki-im3570-lcr',
          fullName: 'Hioki IM3570 LCR Meter',
          description: 'Conductancia (G) y susceptancia (B) por frecuencia',
          protocol: 'tcp',
          produces: 'text/csv',
          sensorValues: [
            { name: 'g', unit: 'S', type: 'double' },
            { name: 'b', unit: 'S', type: 'double' },
          ],
          accessMode: { accessModeType: 'pull' },
        },
      ],
      actuators: [
        {
          actuatorId: 'mux-channel-selector',
          fullName: 'Selector de canal del MUX',
          description: 'Activa un canal del multiplexor antes de medir',
          protocol: 'http',
          inputType: 'integer',
        },
      ],
    };
  }

  async testConnection(ip: string, deviceType: string, port = 3570): Promise<boolean> {
    if (deviceType === HiokiIm3570Plugin.MUX_DEVICE_TYPE) {
      try {
        await axios.get(`http://${ip}`, { timeout: 2000 });
        return true;
      } catch {
        return false;
      }
    }

    return new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host: ip, port });
      socket.setTimeout(2000);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  /** "setActuatorData" del MUX (con reintentos). */
  async selectChannel(muxIp: string, channel: number, retries = 3): Promise<void> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await axios.get(`http://${muxIp}/?orden=${channel}`, {
          timeout: 5000,
          validateStatus: () => true,
        });
        return;
      } catch (error) {
        if (attempt === retries - 1) {
          throw new Error(`Could not activate MUX channel ${channel}: ${error.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  /**
   * "getSensorData" del Hioki: lee byte a byte según protocolo SCPI.
   */
  measureChannel(params: MeasureChannelParams): Promise<MeasuredPoint[]> {
    const { analyzerIp, startFreq, stopFreq, points, sweepType } = params;

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
            const data: MeasuredPoint[] = [];

            for (let i = 0; i + 2 < csvData.length; i += 3) {
              const freq = parseFloat(csvData[i]);
              const g = parseFloat(csvData[i + 1]);
              const b = parseFloat(csvData[i + 2]);

              if (!isNaN(freq) && !isNaN(g) && !isNaN(b)) {
                data.push({ frequency: freq, values: { g, b } });
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
