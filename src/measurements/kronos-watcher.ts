export type MeasurementSeverity = 'correct' | 'warning' | 'error';

export interface MeasurementClassification {
  severity: MeasurementSeverity;
  reason?: string;
  /** true: `reason` debe mostrarse tal cual, sin agregarle contexto de proyecto/dispositivos. */
  bare?: boolean;
}

/**
 * Un punto medido con uno o más arrays de valores por canal (16 slots cada uno),
 * indexados por el nombre del sensorValue (ej. "g", "b" para el Hioki IM3570; un
 * dispositivo futuro podría reportar otros nombres, ej. "voltage", "current").
 */
interface MeasurementPoint {
  frequency: number;
  [valueKey: string]: number | number[];
}

/** sensorValues (ver IEEE 1876 Table 15) a inspeccionar por defecto — los del Hioki IM3570. */
const DEFAULT_VALUE_KEYS = ['g', 'b'];

/** Valor absoluto por debajo del cual una lectura se considera nula. */
const ZERO_EPSILON = 1e-9;

/** % de lecturas nulas a partir del cual se clasifica como error (sensor desconectado / sin señal real). */
const ERROR_ZERO_RATIO = 0.8;

/** % de lecturas nulas a partir del cual se clasifica como warning (posible problema, no concluyente). */
const WARNING_ZERO_RATIO = 0.3;

/**
 * Kronos Watcher — módulo de verificación de mediciones de la plataforma.
 *
 * Clasifica correct/warning/error según qué tan "nulos" vienen los valores de los
 * sensorValues indicados en `valueKeys` (por defecto, "g" y "b" del Hioki IM3570).
 * Es agnóstico al dispositivo: la adquisición de datos se resuelve por plugin
 * (ver device-plugins/), y este clasificador solo necesita saber qué claves de
 * `values` inspeccionar — así puede reutilizarse para otros instrumentos sin
 * cambios, pasando el `valueKeys` que corresponda a su `sensorValues`.
 * Solo revisa los canales efectivamente medidos — los demás slots del array de
 * 16 quedan en 0 por diseño y no son una anomalía.
 */
export function classifyMeasurement(
  measurementData: MeasurementPoint[],
  measuredChannels: number[],
  valueKeys: string[] = DEFAULT_VALUE_KEYS,
): MeasurementClassification {
  if (measurementData.length === 0 || measuredChannels.length === 0) {
    return { severity: 'error', reason: 'No se recibieron datos de medición', bare: true };
  }

  let total = 0;
  let nearZero = 0;

  for (const point of measurementData) {
    for (const channel of measuredChannels) {
      const idx = channel - 1;
      for (const key of valueKeys) {
        const arr = point[key];
        const value = Array.isArray(arr) ? (arr[idx] ?? 0) : 0;
        total += 1;
        if (Math.abs(value) < ZERO_EPSILON) nearZero++;
      }
    }
  }

  const zeroRatio = total === 0 ? 1 : nearZero / total;
  const zeroPercent = Math.round(zeroRatio * 100);

  if (zeroRatio >= ERROR_ZERO_RATIO) {
    return {
      severity: 'error',
      reason: `Valores nulos: ${zeroPercent}% de las lecturas son cero o casi cero`,
    };
  }
  if (zeroRatio >= WARNING_ZERO_RATIO) {
    return {
      severity: 'warning',
      reason: `Posibles valores nulos: ${zeroPercent}% de las lecturas son cero o casi cero`,
    };
  }
  return { severity: 'correct' };
}
