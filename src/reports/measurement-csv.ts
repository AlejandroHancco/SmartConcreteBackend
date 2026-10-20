import { toCsvCell, toCsvRow } from './csv.util';

export const CSV_HEADER = [
  'measurement_id', 'taken_at', 'taken_by', 'preset', 'watcher_status',
  'frequency_hz', 'channel', 'channel_alias', 'g_s', 'b_s',
  'concrete_mix', 'has_emulsifier', 'sample_age', 'temperature', 'humidity', 'notes',
];

export interface CsvChannel {
  channelNumber: number;
  channelAlias: string | null;
  concreteMix: number | null;
  hasEmulsifier: boolean | null;
  sampleAge: number | null;
  temperature: number | null;
  humidity: number | null;
  notes: string | null;
}

export interface CsvMeasurement {
  id: number;
  takenAt: Date | null;
  takenByName: string | null;
  presetName: string | null;
  watcherStatus: string | null;
  data: unknown;
  channels: CsvChannel[];
}

interface StoredPoint {
  frequency: number;
  g?: number[];
  b?: number[];
}

/** Formato largo: una fila por (frecuencia, canal medido). Solo canales con fila en measurement_channels. */
export function measurementToRows(m: CsvMeasurement): unknown[][] {
  const points = Array.isArray(m.data) ? (m.data as StoredPoint[]) : [];
  const channels = [...m.channels].sort((a, b) => a.channelNumber - b.channelNumber);
  const rows: unknown[][] = [];

  for (const point of points) {
    for (const ch of channels) {
      const idx = ch.channelNumber - 1;
      rows.push([
        m.id,
        m.takenAt ? m.takenAt.toISOString() : '',
        m.takenByName ?? '',
        m.presetName ?? '',
        m.watcherStatus ?? '',
        point.frequency,
        ch.channelNumber,
        ch.channelAlias ?? '',
        point.g?.[idx] ?? null,
        point.b?.[idx] ?? null,
        ch.concreteMix,
        ch.hasEmulsifier,
        ch.sampleAge,
        ch.temperature,
        ch.humidity,
        ch.notes,
      ]);
    }
  }
  return rows;
}

/**
 * Preámbulo CSV: BOM (para que Excel lea tildes) + metadatos `# ...` + encabezado.
 * Cada línea de metadatos se pasa por `toCsvCell` como una sola celda: contiene nombres de
 * proyecto/tarea controlados por el usuario, así que comas/comillas se citan (RFC 4180) y no
 * se "parten" en columnas que Excel podría evaluar como fórmula (CSV injection).
 */
export function csvPreamble(metaLines: string[]): string {
  const lines = [
    ...metaLines.map((l) => toCsvCell(`# ${l.replace(/[\r\n]+/g, ' ')}`)),
    CSV_HEADER.join(','),
  ];
  return '﻿' + lines.join('\r\n');
}

/** Líneas CSV (sin BOM ni encabezado) para una medición; una por (frecuencia, canal medido). */
export function rowsToCsvLines(m: CsvMeasurement): string[] {
  return measurementToRows(m).map(toCsvRow);
}

/** CSV completo: preámbulo + filas de todas las mediciones. */
export function buildCsv(metaLines: string[], measurements: CsvMeasurement[]): string {
  const lines = [csvPreamble(metaLines), ...measurements.flatMap(rowsToCsvLines)];
  return lines.join('\r\n');
}
