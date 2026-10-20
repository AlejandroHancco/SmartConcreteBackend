import { buildCsv, CSV_HEADER, measurementToRows, CsvMeasurement } from './measurement-csv';

const channel = (n: number, alias = `Canal ${n}`) => ({
  channelNumber: n, channelAlias: alias, concreteMix: 0.45, hasEmulsifier: false,
  sampleAge: 7, temperature: 22.5, humidity: 60, notes: 'ok',
});

const base: CsvMeasurement = {
  id: 32,
  takenAt: new Date('2026-10-12T14:03:00Z'),
  takenByName: 'Alejandro Hancco',
  presetName: 'Default',
  watcherStatus: 'correct',
  data: [
    { frequency: 1000, g: [0.1, 0.2, 0, 0], b: [0.01, 0.02, 0, 0] },
    { frequency: 2000, g: [0.3, 0.4, 0, 0], b: [0.03, 0.04, 0, 0] },
  ],
  channels: [channel(2), channel(1)],
};

describe('measurementToRows', () => {
  it('una fila por (frecuencia, canal medido), canales ordenados', () => {
    const rows = measurementToRows(base);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual([
      32, '2026-10-12T14:03:00.000Z', 'Alejandro Hancco', 'Default', 'correct',
      1000, 1, 'Canal 1', 0.1, 0.01, 0.45, false, 7, 22.5, 60, 'ok',
    ]);
    expect(rows[1][6]).toBe(2);
    expect(rows[1][8]).toBe(0.2);
    expect(rows[2][5]).toBe(2000);
  });

  it('cada fila tiene tantas columnas como el encabezado', () => {
    for (const row of measurementToRows(base)) expect(row).toHaveLength(CSV_HEADER.length);
  });

  it('sin filas si data está vacío o no es array', () => {
    expect(measurementToRows({ ...base, data: [] })).toEqual([]);
    expect(measurementToRows({ ...base, data: null })).toEqual([]);
  });
});

describe('buildCsv', () => {
  it('BOM, metadatos con #, encabezado y filas con CRLF', () => {
    const csv = buildCsv(['Kronos | Tarea: Viga A'], [base]);
    expect(csv.startsWith('﻿# Kronos | Tarea: Viga A\r\n')).toBe(true);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[1]).toBe(CSV_HEADER.join(','));
    expect(lines).toHaveLength(2 + 4);
  });

  it('protege nombres que parecen fórmulas', () => {
    const csv = buildCsv([], [{ ...base, presetName: '=HACK()' }]);
    expect(csv).toContain(",'=HACK(),");
  });

  it('cita una nota de canal que contiene comas', () => {
    const withComma: CsvMeasurement = {
      ...base,
      channels: [{ ...channel(1), notes: 'ok, revisar' }],
      data: [{ frequency: 1000, g: [0.1], b: [0.01] }],
    };
    const csv = buildCsv([], [withComma]);
    expect(csv).toContain('"ok, revisar"');
  });
});
