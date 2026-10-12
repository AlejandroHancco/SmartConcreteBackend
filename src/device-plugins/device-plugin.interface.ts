/**
 * Contratos de "device plugin" inspirados directamente en IEEE Std 1876-2019
 * (Lab as a Service / LaaS), sección 4 — "First layer of standardization: LaaS".
 *
 * Cada dispositivo soportado por el Kronos Watcher implementa `DeviceDriverPlugin`.
 * measurements.service.ts nunca habla TCP/HTTP directamente con el hardware: resuelve
 * el plugin correspondiente al `device.type` vía `DevicePluginRegistry` y lo invoca a
 * través de esta interfaz. Así, agregar un dispositivo nuevo (type != 'analyzer') no
 * requiere tocar measurements.service.ts — solo registrar un nuevo plugin.
 */

/** Tabla 18 del estándar: cómo se obtienen las lecturas de un sensor. */
export type AccessModeType = 'pull' | 'push' | 'stream';

/** Tabla 15 del estándar: un valor individual que produce un sensor (ej. "g", "b"). */
export interface SensorValueMetadata {
  name: string;
  unit?: string;
  type: 'double' | 'integer' | 'string' | 'boolean';
  rangeMinimum?: number;
  rangeMaximum?: number;
}

/** Tabla 14 del estándar: metadata de un sensor del dispositivo. */
export interface SensorMetadata {
  sensorId: string;
  fullName: string;
  description: string;
  protocol: 'tcp' | 'http';
  produces: string;
  sensorValues: SensorValueMetadata[];
  accessMode: { accessModeType: AccessModeType };
}

/** Tabla 19 del estándar: metadata de un actuator del dispositivo (ej. selector de canal del MUX). */
export interface ActuatorMetadata {
  actuatorId: string;
  fullName: string;
  description: string;
  protocol: 'tcp' | 'http';
  inputType: string;
}

/** "Service description" del dispositivo (4.2 del estándar), recortado a lo que usamos hoy. */
export interface DeviceServiceDescription {
  deviceType: string;
  manufacturer: string;
  description: string;
  sensors: SensorMetadata[];
  actuators: ActuatorMetadata[];
}

/** Un punto medido: una frecuencia con sus valores de sensor por nombre (ej. {g, b}). */
export interface MeasuredPoint {
  frequency: number;
  values: Record<string, number>;
}

export interface MeasureChannelParams {
  analyzerIp: string;
  startFreq: number;
  stopFreq: number;
  points: number;
  sweepType: string;
}

export interface DeviceDriverPlugin {
  describe(): DeviceServiceDescription;

  /**
   * Equivalente a un chequeo de conectividad (usado también por el health check periódico).
   * `deviceType` distingue el sub-rol cuando un mismo plugin cubre más de un `device.type`
   * (ej. HiokiIm3570Plugin resuelve tanto "analyzer" como "mux").
   */
  testConnection(ip: string, deviceType: string, port?: number): Promise<boolean>;

  /** "setActuatorData": selecciona el canal activo en el dispositivo de switching (ej. MUX). */
  selectChannel(muxIp: string, channel: number): Promise<void>;

  /** "getSensorData": mide un rango de frecuencias en el canal ya seleccionado. */
  measureChannel(params: MeasureChannelParams): Promise<MeasuredPoint[]>;
}
